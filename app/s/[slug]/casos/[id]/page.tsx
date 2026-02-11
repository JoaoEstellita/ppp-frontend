"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCaseDetail,
  createPaymentLink,
  devMarkCaseAsPaid,
  devAttachFakePdf,
  requestSupport,
  uploadPppInput,
  listCaseDocuments,
  getDocumentDownloadUrl,
  updateCaseDetails,
  submitCase,
  CaseDetail,
  CaseStatus,
  CaseDocument,
  ApiError,
} from "@/src/services/api";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { supabaseClient } from "@/lib/supabaseClient";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";

type VerificationIssue = {
  field?: string;
  problem?: string;
  severity?: "low" | "medium" | "high" | string;
};

type AnalysisBlock = {
  blockId?: string;
  title?: string;
  isCompliant?: boolean;
  analysis?: string;
  issues?: string[];
};

function safeParseJsonArray<T = any>(value: any): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeGet(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function normalizeText(value?: string | null) {
  return (value ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeDigits(value?: string | null) {
  return (value ?? "").toString().replace(/\D/g, "");
}

function pickFirstString(obj: any, paths: string[]) {
  for (const path of paths) {
    const value = safeGet(obj, path);
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  awaiting_pdf: "Aguardando PDF",
  ready_to_process: "Pronto para análise",
  processing: "Processando",
  paid_processing: "Pago / Processando",
  done: "Concluído",
  pending_info: "Pendências",
  error: "Erro",
};

function isPppOutputType(documentType?: string, fallbackType?: string): boolean {
  const type = String(documentType || fallbackType || "").toLowerCase();
  return type === "ppp_result" || type === "ppp_output";
}

function hasSubmitProgress(
  before: CaseDetail | null | undefined,
  after: CaseDetail | null | undefined
): boolean {
  if (!after) return false;
  const beforeAttempts = Number(before?.case?.submit_attempts ?? 0);
  const afterAttempts = Number(after.case?.submit_attempts ?? 0);
  if (afterAttempts > beforeAttempts) return true;
  if ((after.case?.last_submit_at || "") !== (before?.case?.last_submit_at || "")) return true;
  if (after.case?.status === "processing" || after.case?.status === "paid_processing") return true;
  if (after.case?.last_n8n_status === "submitted" || after.case?.last_n8n_status === "success") return true;
  return false;
}

function getApiStatus(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err) {
    const value = (err as { status?: unknown }).status;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function isTransientSubmitError(err: unknown): boolean {
  const status = getApiStatus(err);
  if (status === null) return false;
  return status >= 500 && status <= 504;
}

function isRecentIsoDate(value: string | null | undefined, maxAgeMs: number): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= maxAgeMs;
}

function isGatewayTransientMessage(value: string | null | undefined): boolean {
  const text = String(value || "").toLowerCase();
  if (!text) return false;
  return (
    /http\s*(500|502|503|504)/.test(text) ||
    text.includes("bad gateway") ||
    text.includes("gateway timeout") ||
    text.includes("timeout")
  );
}

function isTransientGatewaySubmitState(caseData: CaseDetail["case"] | null | undefined): boolean {
  if (!caseData) return false;
  const looksLikeGatewayError =
    caseData.last_n8n_status === "error" &&
    isGatewayTransientMessage(caseData.last_n8n_error);
  if (!looksLikeGatewayError) return false;
  const submitAt = caseData.last_submit_at ? new Date(caseData.last_submit_at).getTime() : NaN;
  const callbackAt = caseData.last_n8n_callback_at ? new Date(caseData.last_n8n_callback_at).getTime() : NaN;
  const hasValidSubmit = !Number.isNaN(submitAt);
  const hasValidCallback = !Number.isNaN(callbackAt);
  if (!hasValidSubmit) return false;
  if (!isRecentIsoDate(caseData.last_submit_at, 5 * 60 * 1000)) return false;
  if (!hasValidCallback) return true;
  // callback antigo de tentativa anterior: ainda é estado transitório desta nova tentativa
  return submitAt > callbackAt;
}

function getStatusBadgeVariant(status: CaseStatus): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "done":
      return "success";
    case "processing":
    case "paid_processing":
      return "info";
    case "ready_to_process":
      return "success";
    case "awaiting_payment":
    case "awaiting_pdf":
      return "warning";
    case "pending_info":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

function getClassificationLabel(value?: string | null) {
  if (!value) return "Não informado";
  switch (value) {
    case "ATENDE_INTEGRALMENTE":
      return "Atende integralmente";
    case "POSSUI_INCONSISTENCIAS_SANAVEIS":
      return "Possui inconsistências sanáveis";
    case "NAO_POSSUI_VALIDADE_TÉCNICA":
      return "Não possui validade técnica";
    default:
      return value;
  }
}

function SeverityBadge({ severity }: { severity?: string }) {
  const level = (severity || "low").toLowerCase();
  const styles =
    level === "high"
      ? "bg-red-100 text-red-700"
      : level === "medium"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-green-100 text-green-700";
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${styles}`}>
      {severity || "low"}
    </span>
  );
}

function StatusPanel({
  status,
  subtitle,
}: {
  status: "blocked" | "validation_failed" | "review" | "approved";
  subtitle: string;
}) {
  const badge =
    status === "validation_failed"
      ? "FALHA DE VALIDAÇÃO TÉCNICA"
      : status === "blocked"
      ? "BLOQUEADO POR CONFLITO"
      : status === "review"
      ? "EM REVISÃO"
      : "APROVADO PARA EMISSÃO";
  const badgeStyle =
    status === "blocked"
      ? "bg-red-100 text-red-700"
      : status === "validation_failed"
      ? "bg-yellow-100 text-yellow-700"
      : status === "review"
      ? "bg-orange-100 text-orange-700"
      : "bg-green-100 text-green-700";

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-2">
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badgeStyle}`}>
          {badge}
        </span>
        <p className="text-sm text-gray-600">{subtitle}</p>
      </div>
    </div>
  );
}

function ConflictList({
  issues,
  blocked,
  onRetry,
}: {
  issues: VerificationIssue[];
  blocked: boolean;
  onRetry?: () => void;
}) {
  if (!issues.length) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-red-800">Conflitos detectados</h3>
        <p className="text-xs text-red-600 mt-1">
          Revise os campos abaixo antes de gerar o resultado final.
        </p>
      </div>
      <div className="space-y-3">
        {issues.map((issue, index) => (
          <div key={`${issue.field || "field"}-${index}`} className="bg-white rounded-md p-3 border border-red-100">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">
                {issue.field || "Campo não informado"}
              </p>
              <SeverityBadge severity={issue.severity} />
            </div>
            <p className="text-xs text-gray-600 mt-1">{issue.problem || "Problema não informado."}</p>
          </div>
        ))}
      </div>
      {blocked && (
        <Button onClick={onRetry} className="bg-red-600 hover:bg-red-700 text-white">
          Reenviar com dados corretos
        </Button>
      )}
    </div>
  );
}

function BlocksList({ blocks }: { blocks: AnalysisBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-600">Inconsistências por campo</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {blocks.map((block, index) => {
          const compliant = block.isCompliant !== false;
          return (
            <div
              key={`${block.blockId || "block"}-${index}`}
              className={`rounded-lg border p-4 space-y-2 ${
                compliant ? "border-green-100 bg-green-50" : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {block.title || "Bloco sem título"}
                  </p>
                  {block.blockId && (
                    <p className="text-xs text-gray-500">Bloco {block.blockId}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold ${compliant ? "text-green-700" : "text-red-700"}`}>
                  {compliant ? "Conforme" : "Não conforme"}
                </span>
              </div>
              {block.analysis && <p className="text-xs text-gray-700">{block.analysis}</p>}
              {Array.isArray(block.issues) && block.issues.length > 0 && (
                <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">
                  {block.issues.map((issue, issueIndex) => (
                    <li key={`${index}-${issueIndex}`}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Componente para botão de download de PDF
function DownloadPdfButton({ slug, caseId, docId }: { slug: string; caseId: string; docId: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!docId) return;
    try {
      setDownloading(true);
      const { signedUrl } = await getDocumentDownloadUrl(slug, caseId, docId);
      if (signedUrl) {
        window.open(signedUrl, "_blank");
      }
    } catch {
      // Silenciar erro
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading || !docId}
      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
    >
      {downloading ? "..." : "Baixar"}
    </button>
  );
}

type TimelineEventTone = "default" | "info" | "success" | "warning" | "danger";

type TimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
  tone: TimelineEventTone;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function getSlaByStatus(status: CaseStatus): {
  title: string;
  target: string;
  nextAction: string;
} {
  switch (status) {
    case "awaiting_payment":
      return {
        title: "Etapa: aguardando pagamento",
        target: "SLA operacional: confirmacao em ate 30 minutos apos o pagamento.",
        nextAction: "Se ja pagou e nao atualizou, clique em Recarregar status.",
      };
    case "awaiting_pdf":
      return {
        title: "Etapa: aguardando envio do PPP",
        target: "SLA inicia apos upload do PDF.",
        nextAction: "Envie o PDF para liberar o processamento.",
      };
    case "ready_to_process":
      return {
        title: "Etapa: pronto para enviar",
        target: "SLA operacional: envio imediato ao n8n apos clicar em Enviar para analise.",
        nextAction: "Clique em Enviar para analise.",
      };
    case "processing":
    case "paid_processing":
      return {
        title: "Etapa: processamento em andamento",
        target: "SLA operacional: retorno tecnico entre 5 e 15 minutos.",
        nextAction: "Aguarde ou recarregue o status em alguns minutos.",
      };
    case "done":
      return {
        title: "Etapa: concluido",
        target: "SLA cumprido. Resultado final disponivel para download.",
        nextAction: "Baixe o PDF final e revise o parecer.",
      };
    case "error":
      return {
        title: "Etapa: erro operacional",
        target: "SLA de recuperacao: tentativa imediata apos ajuste ou reenvio.",
        nextAction: "Siga o bloco 'O que fazer agora' e tente novamente.",
      };
    case "pending_info":
      return {
        title: "Etapa: pendencias",
        target: "SLA pausado ate regularizacao dos dados.",
        nextAction: "Atualize os dados do cadastro e reenviar.",
      };
    default:
      return {
        title: "Etapa: em acompanhamento",
        target: "SLA operacional conforme etapa atual.",
        nextAction: "Recarregue o status se necessario.",
      };
  }
}

function getOperationalNextSteps(errorCode: string, hasPppInput: boolean): string[] {
  const baseSteps = [
    "Recarregue o status para confirmar o estado mais recente.",
    "Se o problema persistir, acione o suporte com uma descricao objetiva do erro.",
  ];
  switch (errorCode) {
    case "ocr_size_limit":
      return [
        "Reduza o tamanho do arquivo (ideal ate 5MB) e reenvie o PDF.",
        "Prefira PDF nativo ou digitalizado em preto e branco com 150-200 DPI.",
        ...baseSteps,
      ];
    case "download_failed":
      return [
        "Reenvie o PDF para atualizar o arquivo no armazenamento.",
        "Evite arquivo protegido por senha ou corrompido.",
        ...baseSteps,
      ];
    case "ocr_failed":
      return [
        "Reenvie um PDF com melhor nitidez, sem cortes e sem inclinacao.",
        "Se o arquivo vier de foto, gere um PDF mais limpo antes do upload.",
        ...baseSteps,
      ];
    case "conflict_detected":
    case "worker_cpf_conflict":
      return [
        "Revise os dados do cadastro (nome/CPF/CNPJ) e corrija os campos divergentes.",
        "Reenvie o PDF apos salvar as correcoes.",
        ...baseSteps,
      ];
    case "validation_failed":
      return [
        "Valide os dados obrigatorios do cadastro e reenvie o documento.",
        "Se houver campos faltantes no PPP, solicite nova emissao do documento.",
        ...baseSteps,
      ];
    default:
      return hasPppInput
        ? [
            "Reenvie o PDF para disparar nova tentativa de processamento.",
            ...baseSteps,
          ]
        : [
            "Envie o PDF do PPP para iniciar o processamento.",
            ...baseSteps,
          ];
  }
}

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";
  const caseId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [attachingPdf, setAttachingPdf] = useState(false);
  const [requestingSupport, setRequestingSupport] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSent, setSupportSent] = useState(false);
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [detailsMessage, setDetailsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [workerNameEdit, setWorkerNameEdit] = useState("");
  const [workerCpfEdit, setWorkerCpfEdit] = useState("");
  const [companyNameEdit, setCompanyNameEdit] = useState("");
  const [companyCnpjEdit, setCompanyCnpjEdit] = useState("");
  const [reuploading, setReuploading] = useState(false);
  const [reuploadMessage, setReuploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Estados para upload de PDF
  const [uploadingPdf, setUploadingPdf] = useState(false);
  
  // Estado para submit para análise
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caseDocuments, setCaseDocuments] = useState<CaseDocument[]>([]);

  // Verificar acesso do usuário (platform_admin)
  const { isPlatformAdmin } = useOrgAccess();

  // Detectar ambiente de desenvolvimento + verificar se é platform_admin
  const isDevModeEnabled = process.env.NEXT_PUBLIC_DEV_MODE === "true";
  const showDevTools = isPlatformAdmin && isDevModeEnabled;

  // Memoize fetchCase para usar em useEffect
  const fetchCase = useCallback(async () => {
    if (!slug || !caseId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getCaseDetail(slug, caseId);
      setCaseDetail(data);
      setPaymentUrl(data.case.payment?.paymentUrl ?? data.case.payment?.payment_url ?? null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Não foi possível carregar o caso.");
      } else {
        setError("Não foi possível carregar o caso.");
      }
    } finally {
      setLoading(false);
    }
  }, [slug, caseId]);

  // Effect para carregar o caso
  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  // Polling automático quando caso está em processing (a cada 10 segundos)
  useEffect(() => {
    const status = caseDetail?.case?.status;
    const transientGatewaySubmit = isTransientGatewaySubmitState(caseDetail?.case || null);
    const hasError =
      (!transientGatewaySubmit && !!caseDetail?.case?.last_error_code) ||
      (!transientGatewaySubmit && !!caseDetail?.case?.last_error_message) ||
      (!transientGatewaySubmit && caseDetail?.case?.last_n8n_status === "error");
    if (status !== "processing" && status !== "paid_processing" && !transientGatewaySubmit) return;
    if (hasError) return;

    const interval = setInterval(() => {
      fetchCase();
    }, 10000); // 10 segundos

    return () => clearInterval(interval);
  }, [
    caseDetail?.case?.status,
    caseDetail?.case?.last_error_code,
    caseDetail?.case?.last_error_message,
    caseDetail?.case?.last_n8n_status,
    caseDetail?.case?.last_n8n_error,
    caseDetail?.case?.last_n8n_callback_at,
    caseDetail?.case?.last_submit_at,
    caseDetail?.case,
    fetchCase,
  ]);

  // Derivar downloadUrl de caseDetail (memoizado para evitar recálculos)
  const downloadUrl = useMemo(() => {
    if (!caseDetail) return undefined;
    const pdfDoc = (caseDetail.case.documents ?? []).find((doc) => {
      const type = String(doc.document_type ?? doc.type ?? "").toLowerCase();
      return type === "ppp_result" || type === "ppp_output";
    });
    return pdfDoc?.url ?? undefined;
  }, [caseDetail]);

  // Effect para resolver signed URL do PDF - AGORA no topo, antes de qualquer return condicional
  useEffect(() => {
    let active = true;

    async function resolveUrl() {
      if (!downloadUrl) {
        if (active) setSignedUrl(null);
        return;
      }
      if (downloadUrl.startsWith("http")) {
        if (active) setSignedUrl(downloadUrl);
        return;
      }
      try {
        const bucket = process.env.NEXT_PUBLIC_SUPABASE_PPP_BUCKET || "PPP";
        const { data } = await supabaseClient.storage
          .from(bucket)
          .createSignedUrl(downloadUrl, 3600);
        if (active) {
          setSignedUrl(data?.signedUrl ?? null);
        }
      } catch {
        if (active) setSignedUrl(null);
      }
    }

    resolveUrl();

    return () => {
      active = false;
    };
  }, [downloadUrl]);

  // Handler para criar link de pagamento
  const handleCreatePaymentLink = useCallback(async () => {
    if (!slug || !caseId) return;
    try {
      setCreatingLink(true);
      const data = await createPaymentLink(slug, caseId);
      setPaymentUrl(data.paymentUrl ?? data.payment_url ?? null);
    } catch {
      setError("Não foi possível gerar o link de pagamento.");
    } finally {
      setCreatingLink(false);
    }
  }, [slug, caseId]);

  // Handler DEV para marcar como pago
  const handleDevMarkPaid = useCallback(async () => {
    if (!slug || !caseId) return;
    try {
      setMarkingPaid(true);
      setError(null);
      await devMarkCaseAsPaid(slug, caseId);
      // Recarrega o caso após marcar como pago
      await fetchCase();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Não foi possível marcar como pago.");
      } else {
        setError("Não foi possível marcar como pago.");
      }
    } finally {
      setMarkingPaid(false);
    }
  }, [slug, caseId, fetchCase]);

  // Handler DEV para anexar PDF fake
  const handleDevAttachPdf = useCallback(async () => {
    if (!slug || !caseId) return;
    try {
      setAttachingPdf(true);
      setError(null);
      await devAttachFakePdf(slug, caseId);
      // Recarrega o caso após anexar PDF
      await fetchCase();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Não foi possível anexar o PDF.");
      } else {
        setError("Não foi possível anexar o PDF.");
      }
    } finally {
      setAttachingPdf(false);
    }
  }, [slug, caseId, fetchCase]);

  // Handler para solicitar suporte
  const handleRequestSupport = useCallback(async () => {
    if (!slug || !caseId) return;
    try {
      setRequestingSupport(true);
      setActionMessage(null);
      await requestSupport(slug, caseId, supportMessage);
      setActionMessage({ type: "success", text: "Solicitação de suporte enviada!" });
      setSupportSent(true);
      setShowSupportForm(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionMessage({ type: "error", text: err.message || "Não foi possível enviar solicitação." });
      } else {
        setActionMessage({ type: "error", text: "Não foi possível enviar solicitação." });
      }
    } finally {
      setRequestingSupport(false);
    }
  }, [slug, caseId, supportMessage]);

  // Handler para upload de PDF
  const handleUploadPdf = useCallback(async () => {
    if (!slug || !caseId || !selectedFile) return;
    try {
      setUploadingPdf(true);
      setActionMessage(null);
      await uploadPppInput(slug, caseId, selectedFile);
      setActionMessage({ type: "success", text: "PDF enviado com sucesso!" });
      setSelectedFile(null);
      // fetchCase vai atualizar caseDetail, que dispara o useEffect para fetchDocuments
      await fetchCase();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionMessage({ type: "error", text: err.message || "Não foi possível enviar o PDF." });
      } else {
        setActionMessage({ type: "error", text: "Não foi possível enviar o PDF." });
      }
    } finally {
      setUploadingPdf(false);
    }
  }, [slug, caseId, selectedFile, fetchCase]);

  const handleReuploadFile = useCallback(
    async (file: File) => {
      if (!slug || !caseId || !file) return;
      try {
        setReuploading(true);
        setReuploadMessage(null);
        await uploadPppInput(slug, caseId, file);
        setReuploadMessage({ type: "success", text: "PPP reenviado. Processamento reiniciado." });
        await fetchCase();
      } catch (err) {
        if (err instanceof ApiError) {
          setReuploadMessage({ type: "error", text: err.message || "Não foi possível reenviar o PPP." });
        } else {
          setReuploadMessage({ type: "error", text: "Não foi possível reenviar o PPP." });
        }
      } finally {
        setReuploading(false);
      }
    },
    [slug, caseId, fetchCase]
  );

  // Handler para enviar para análise (n8n)
  const handleSubmitForAnalysis = useCallback(async () => {
    if (!slug || !caseId) return;
    const snapshotBeforeSubmit = caseDetail;
    try {
      setSubmitting(true);
      setActionMessage(null);
      const latest = await getCaseDetail(slug, caseId);
      setCaseDetail(latest);
      const latestStatus = latest.case.status as CaseStatus;
      const latestDoneByCallback = latest.case.last_n8n_status === "success";
      const latestDoneByDocument = (latest.case.documents || []).some((doc) =>
        isPppOutputType(doc.document_type, doc.type)
      );
      if (latestStatus === "done" || latestDoneByCallback || latestDoneByDocument) {
        setActionMessage({ type: "error", text: "Caso já foi concluído. Atualize a página para ver o resultado." });
        return;
      }
      const result = await submitCase(slug, caseId);
      if (result.ok) {
        setActionMessage({ type: "success", text: result.message || "Enviado para análise!" });
        await fetchCase();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const message = String(err.message || "").toLowerCase();
        if (err.status === 400 && message.includes("conclu")) {
          setActionMessage({ type: "error", text: "Caso já foi concluído. Não é possível reprocessar." });
          await fetchCase();
        } else {
          setActionMessage({ type: "error", text: err.message || "Não foi possível enviar para análise." });
        }
      } else if (!isTransientSubmitError(err)) {
        setActionMessage({ type: "error", text: "Não foi possível enviar para análise." });
      }

      if (isTransientSubmitError(err)) {
        setActionMessage({
          type: "success",
          text: "Envio recebido pelo backend e em validação. Aguarde alguns segundos enquanto confirmamos o status.",
        });
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            const latest = await getCaseDetail(slug, caseId);
            setCaseDetail(latest);
            if (hasSubmitProgress(snapshotBeforeSubmit, latest)) {
              setActionMessage({
                type: "success",
                text: "Envio confirmado. O caso foi encaminhado para processamento.",
              });
              return;
            }
          } catch {
            // segue tentando nas próximas iterações
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        setActionMessage({
          type: "success",
          text: "Envio em validação. Se o status não atualizar em até 1 minuto, tente reenviar.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [slug, caseId, caseDetail, fetchCase]);

  const handleSaveDetails = useCallback(async () => {
    if (!slug || !caseId) return;
    try {
      setSavingDetails(true);
      setDetailsMessage(null);
      await updateCaseDetails(slug, caseId, {
        workerName: workerNameEdit.trim(),
        workerCPF: workerCpfEdit.trim(),
        companyName: companyNameEdit.trim(),
        companyCNPJ: companyCnpjEdit.trim(),
      });
      setDetailsDirty(false);
      setDetailsMessage({ type: "success", text: "Dados atualizados com sucesso." });
      await fetchCase();
      setEditingDetails(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setDetailsMessage({ type: "error", text: err.message || "Não foi possível salvar os dados." });
      } else {
        setDetailsMessage({ type: "error", text: "Não foi possível salvar os dados." });
      }
    } finally {
      setSavingDetails(false);
    }
  }, [slug, caseId, workerNameEdit, workerCpfEdit, companyNameEdit, companyCnpjEdit, fetchCase]);

  // Carregar documentos do caso
  const fetchDocuments = useCallback(async () => {
    if (!slug || !caseId) return;
    try {
      const docs = await listCaseDocuments(slug, caseId);
      setCaseDocuments(docs);
    } catch {
      // Silenciar erro - não é crítico
    }
  }, [slug, caseId]);

  useEffect(() => {
    if (caseDetail) {
      fetchDocuments();
    }
  }, [caseDetail, fetchDocuments]);

  useEffect(() => {
    if (!caseDetail || detailsDirty || editingDetails) return;
    const cadastroWorkerName = caseDetail.worker?.name ?? caseDetail.case.worker?.name ?? "";
    const cadastroWorkerCpf = caseDetail.worker?.cpf ?? caseDetail.case.worker?.cpf ?? "";
    const cadastroCompanyName = caseDetail.company?.name ?? caseDetail.case.company?.name ?? "";
    const cadastroCompanyCnpj = caseDetail.company?.cnpj ?? caseDetail.case.company?.cnpj ?? "";
    setWorkerNameEdit(cadastroWorkerName);
    setWorkerCpfEdit(cadastroWorkerCpf);
    setCompanyNameEdit(cadastroCompanyName);
    setCompanyCnpjEdit(cadastroCompanyCnpj);
  }, [caseDetail, detailsDirty, editingDetails]);

  // Verificar se tem documento PPP input
  const hasPppInput = useMemo(() => {
    return caseDocuments.some((doc) => {
      const type = (doc.document_type || (doc as { type?: string }).type || "").toLowerCase();
      return type === "ppp_input";
    });
  }, [caseDocuments]);

  const pppInputDoc = useMemo(() => {
    return caseDocuments.find((doc) => {
      const type = (doc.document_type || (doc as { type?: string }).type || "").toLowerCase();
      return type === "ppp_input";
    });
  }, [caseDocuments]);

  // Verificar se tem documento PPP output (resultado final)
  const pppOutputDoc = useMemo(() => {
    return caseDocuments.find((doc) => {
      return isPppOutputType(doc.document_type, (doc as { type?: string }).type);
    });
  }, [caseDocuments]);

  // Verificar se pode enviar para análise
  const canSubmitForAnalysis = useMemo(() => {
    const status = caseDetail?.case.status as CaseStatus;
    const n8nStatus = caseDetail?.case.last_n8n_status;
    const alreadyDone = status === "done" || n8nStatus === "success" || Boolean(pppOutputDoc);
    return (status === "ready_to_process" || status === "error") && hasPppInput && !alreadyDone;
  }, [caseDetail?.case.status, caseDetail?.case.last_n8n_status, hasPppInput, pppOutputDoc]);

  // Renderização condicional - APÓS todos os hooks
  if (loading) {
    return <div className="text-gray-600">Carregando caso...</div>;
  }

  if (error || !caseDetail) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{error || "Caso nao encontrado."}</p>
        <Button onClick={() => router.push(`/s/${slug}/casos`)} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const { case: caseRecord, worker, company, workflowLogs } = caseDetail;
  const status = caseRecord.status as CaseStatus;
  const statusLabel = STATUS_LABELS[status] ?? status;
  const analysis = caseDetail.analysis ?? null;
  const analysisPayload =
    (analysis?.raw_ai_result ??
      analysis?.extra_metadata ??
      analysis?.results ??
      analysis?.rules_result ??
      {}) as Record<string, any>;
  const validationOk =
    analysisPayload.validation_ok ??
    analysisPayload.validationOk ??
    analysisPayload.verification_ok ??
    undefined;
  const validationIssues = safeParseJsonArray<string>(
    analysisPayload.validation_issues ?? analysisPayload.validationIssues
  );
  const verifierOk =
    analysisPayload.verifier_ok ??
    analysisPayload.verifierOk ??
    analysisPayload.verification_ok ??
    undefined;
  const verifierRisk =
    analysisPayload.verifier_risk ??
    analysisPayload.verifierRisk ??
    analysisPayload.verification_risk ??
    "unknown";
  const verifierIssues = safeParseJsonArray<VerificationIssue>(
    analysisPayload.verifier_issues ??
      analysisPayload.verifierIssues ??
      analysisPayload.verification_issues ??
      analysisPayload.verificationIssues
  );
  const verifierMustFix = safeParseJsonArray<string>(
    analysisPayload.verifier_must_fix ?? analysisPayload.verifierMustFix
  );
  const analysisSummary =
    analysisPayload.analysis_summary ??
    safeGet(analysisPayload, "results.summary") ??
    safeGet(analysis, "results.summary") ??
    "";
  const finalClassification =
    analysisPayload.finalClassification ??
    analysisPayload.final_classification ??
    analysis?.finalClassification ??
    analysis?.final_classification ??
    null;
  const analysisBlocks = safeParseJsonArray<AnalysisBlock>(
    safeGet(analysisPayload, "results.blocks") ??
      safeGet(analysis, "results.blocks") ??
      analysisPayload.analysis_blocks ??
      analysisPayload.blocks
  );
  const extractedWorkerName = pickFirstString(analysisPayload, [
    "worker_name",
    "workerName",
    "worker.name",
    "results.worker_name",
    "results.worker.name",
  ]);
  const extractedWorkerCpf = pickFirstString(analysisPayload, [
    "worker_cpf",
    "workerCPF",
    "worker.cpf",
    "results.worker_cpf",
    "results.worker.cpf",
  ]);
  const extractedCompanyName = pickFirstString(analysisPayload, [
    "company_name",
    "companyName",
    "employer_name",
    "company.name",
    "employer.name",
    "results.company_name",
    "results.company.name",
  ]);
  const extractedCompanyCnpj = pickFirstString(analysisPayload, [
    "company_cnpj",
    "companyCNPJ",
    "employer_cnpj",
    "company.cnpj",
    "employer.cnpj",
    "results.company_cnpj",
    "results.company.cnpj",
  ]);
  const cadastroWorkerName = worker?.name ?? caseRecord.worker?.name ?? "";
  const cadastroWorkerCpf = worker?.cpf ?? caseRecord.worker?.cpf ?? "";
  const cadastroCompanyName = company?.name ?? caseRecord.company?.name ?? "";
  const cadastroCompanyCnpj = company?.cnpj ?? caseRecord.company?.cnpj ?? "";
  const conflictItems: Array<{ label: string; cadastro: string; extraido: string }> = [];
  if (
    extractedWorkerName &&
    cadastroWorkerName &&
    normalizeText(extractedWorkerName) !== normalizeText(cadastroWorkerName)
  ) {
    conflictItems.push({
      label: "Nome do trabalhador",
      cadastro: cadastroWorkerName,
      extraido: extractedWorkerName,
    });
  }
  if (
    extractedWorkerCpf &&
    cadastroWorkerCpf &&
    normalizeDigits(extractedWorkerCpf) !== normalizeDigits(cadastroWorkerCpf)
  ) {
    conflictItems.push({
      label: "CPF do trabalhador",
      cadastro: cadastroWorkerCpf,
      extraido: extractedWorkerCpf,
    });
  }
  if (
    extractedCompanyName &&
    cadastroCompanyName &&
    normalizeText(extractedCompanyName) !== normalizeText(cadastroCompanyName)
  ) {
    conflictItems.push({
      label: "Empresa",
      cadastro: cadastroCompanyName,
      extraido: extractedCompanyName,
    });
  }
  if (
    extractedCompanyCnpj &&
    cadastroCompanyCnpj &&
    normalizeDigits(extractedCompanyCnpj) !== normalizeDigits(cadastroCompanyCnpj)
  ) {
    conflictItems.push({
      label: "CNPJ da empresa",
      cadastro: cadastroCompanyCnpj,
      extraido: extractedCompanyCnpj,
    });
  }
  const hasExtractedData = Boolean(
    extractedWorkerName || extractedWorkerCpf || extractedCompanyName || extractedCompanyCnpj
  );
  const hasValidationFailure = validationOk === false;
  const hasVerifierBlock =
    verifierOk === false ||
    String(verifierRisk || "").toLowerCase() === "high" ||
    verifierMustFix.length > 0;
  const isReview =
    !hasValidationFailure &&
    !hasVerifierBlock &&
    String(verifierRisk || "").toLowerCase() === "medium";
  const statusPanelState = hasValidationFailure
    ? "validation_failed"
    : hasVerifierBlock
    ? "blocked"
    : isReview
    ? "review"
    : "approved";
  const statusSubtitle = hasValidationFailure
    ? "Não foi possível gerar o parecer por inconsistência ou ausência de dados mínimos."
    : hasVerifierBlock
    ? "Há contradição clara entre dados informados e o documento apresentado."
    : isReview
    ? "Recomendamos revisar ou reenviar para melhorar a conferencia."
    : "Análise concluída sem conflitos críticos.";
  const errorCode = String(caseRecord.last_error_code ?? "").toLowerCase();
  const transientGatewaySubmit = isTransientGatewaySubmitState(caseRecord);
  const errorReasonPublic =
    (transientGatewaySubmit ? null : caseRecord.last_error_message) ??
    (transientGatewaySubmit ? null : caseRecord.last_n8n_error) ??
    (errorCode === "ocr_size_limit"
      ? "O arquivo enviado e muito grande para leitura automatica (limite 5MB). Reenvie um PDF menor ou comprimido."
      : errorCode === "download_failed"
      ? "Falha ao baixar o PDF enviado. Reenvie o arquivo."
      : errorCode === "ocr_failed"
      ? "Falha na leitura do documento. Reenvie o PDF com melhor qualidade."
      : errorCode === "conflict_detected"
      ? "Há divergências entre cadastro e documento."
      : errorCode === "validation_failed"
      ? "Falha de validacao tecnica. Verifique os dados e reenviar o PPP."
      : "");
  const hasErrorPayload = !transientGatewaySubmit && Boolean(errorCode || errorReasonPublic);
  const effectiveErrorCode =
    errorCode ||
    (hasValidationFailure ? "validation_failed" : hasVerifierBlock ? "conflict_detected" : "");
  const errorTitle =
    effectiveErrorCode === "download_failed" || effectiveErrorCode === "ocr_failed"
      ? "FALHA NA LEITURA DO DOCUMENTO"
      : effectiveErrorCode === "validation_failed"
      ? "FALHA DE VALIDAÇÃO TÉCNICA"
      : effectiveErrorCode === "conflict_detected"
      ? "BLOQUEADO POR CONFLITO DE DADOS"
      : effectiveErrorCode === "worker_cpf_conflict"
      ? "DIVERGENCIA NO CPF"
      : "ERRO DE PROCESSAMENTO";
  const showErrorBanner = (status === "error" || hasErrorPayload) && !transientGatewaySubmit;
  const slaInfo = getSlaByStatus(status);
  const nextSteps = getOperationalNextSteps(effectiveErrorCode, hasPppInput);
  const timelineEvents = (() => {
    const events: TimelineEvent[] = [];
    const push = (
      id: string,
      at: string | null | undefined,
      title: string,
      detail: string,
      tone: TimelineEventTone = "default"
    ) => {
      if (!at) return;
      const timestamp = new Date(at).getTime();
      if (Number.isNaN(timestamp)) return;
      events.push({ id, at, title, detail, tone });
    };

    push(
      "case-created",
      caseRecord.createdAt,
      "Caso criado",
      "Cadastro inicial do trabalhador e empresa.",
      "default"
    );
    push(
      "case-updated",
      caseRecord.updatedAt,
      "Ultima atualizacao",
      "Registro geral de alteracao do caso.",
      "default"
    );
    push(
      "submit-attempt",
      caseRecord.last_submit_at,
      "Enviado para analise",
      `Tentativas de envio: ${caseRecord.submit_attempts ?? 0}.`,
      "info"
    );
    push(
      "processing-started",
      caseRecord.processing_started_at,
      "Processamento iniciado",
      "Documento recebido no fluxo de processamento.",
      "info"
    );
    push(
      "callback-received",
      caseRecord.last_n8n_callback_at,
      "Callback recebido",
      `Retorno do n8n com status: ${caseRecord.last_n8n_status || "-"}.`,
      transientGatewaySubmit
        ? "info"
        : caseRecord.last_n8n_status === "success"
        ? "success"
        : caseRecord.last_n8n_status === "error"
        ? "danger"
        : "info"
    );
    push(
      "error",
      caseRecord.last_error_at,
      "Falha operacional",
      caseRecord.last_error_message || caseRecord.last_n8n_error || "Erro registrado no processamento.",
      "danger"
    );

    (workflowLogs || []).forEach((log) => {
      push(
        `workflow-${log.id}`,
        log.created_at,
        `Workflow: ${log.step}`,
        `${log.status || "sem status"}${log.message ? ` - ${log.message}` : ""}`,
        log.status === "success" ? "success" : log.status === "error" ? "danger" : "default"
      );
    });

    const dedup = new Map<string, TimelineEvent>();
    events.forEach((event) => {
      const key = `${event.title}-${event.at}`;
      if (!dedup.has(key)) {
        dedup.set(key, event);
      }
    });

    return Array.from(dedup.values()).sort((a, b) => {
      return new Date(a.at).getTime() - new Date(b.at).getTime();
    });
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Caso #{caseRecord.id}</h2>
        <div className="flex items-center gap-2">
          {(status === "done" || caseRecord.last_n8n_status === "success") && pppOutputDoc && (
            <DownloadPdfButton slug={slug} caseId={caseId} docId={pppOutputDoc.id} />
          )}
          <Badge variant={getStatusBadgeVariant(status)}>{statusLabel}</Badge>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Trabalhador</h3>
          <p className="text-gray-900">{worker?.name || "-"}</p>
          <p className="text-sm text-gray-600">{worker?.cpf || "-"}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Empresa</h3>
          <p className="text-gray-900">{company?.name || "-"}</p>
          <p className="text-sm text-gray-600">{company?.cnpj || "-"}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-2">
        <h3 className="text-sm font-semibold text-blue-900">{slaInfo.title}</h3>
        <p className="text-sm text-blue-800">{slaInfo.target}</p>
        <p className="text-xs text-blue-700">Proxima acao recomendada: {slaInfo.nextAction}</p>
      </div>

      {transientGatewaySubmit && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Envio em validação: o n8n já foi acionado e estamos aguardando o callback final.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Linha do tempo do caso</h3>
        {timelineEvents.length === 0 ? (
          <p className="text-sm text-gray-500">Ainda sem eventos registrados para este caso.</p>
        ) : (
          <ol className="space-y-3">
            {timelineEvents.map((event) => (
              <li key={event.id} className="rounded-md border border-gray-200 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      event.tone === "danger"
                        ? "text-red-700"
                        : event.tone === "success"
                        ? "text-green-700"
                        : event.tone === "warning"
                        ? "text-amber-700"
                        : event.tone === "info"
                        ? "text-blue-700"
                        : "text-gray-800"
                    }`}
                  >
                    {event.title}
                  </span>
                  <span className="text-xs text-gray-500">{formatDateTime(event.at)}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{event.detail}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {showErrorBanner && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-red-800">{errorTitle}</h3>
              <p className="text-xs text-red-700 mt-1">
                {errorReasonPublic ||
                  "Houve um problema no processamento. Atualize os dados e reenvie o PPP."}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                id="ppp-reupload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleReuploadFile(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
              <Button
                onClick={() => {
                  const input = document.getElementById("ppp-reupload") as HTMLInputElement | null;
                  input?.click();
                }}
                disabled={reuploading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {reuploading ? "Reenviando..." : "Reenviar PDF"}
              </Button>
              <Button
                onClick={fetchCase}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Recarregar status
              </Button>
            </div>
          </div>
          {reuploadMessage && (
            <div
              className={`text-xs px-3 py-2 rounded ${
                reuploadMessage.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {reuploadMessage.text}
            </div>
          )}
          <div className="bg-white rounded-md p-3 border border-red-100 text-xs text-gray-700">
            <p className="font-semibold text-gray-800">Ultimo problema</p>
            <p>Codigo: {caseRecord.last_error_code || "-"}</p>
            <p>Mensagem: {caseRecord.last_error_message || "-"}</p>
            <p>Etapa: {caseRecord.last_error_step || "-"}</p>
            <p>Status N8N: {caseRecord.last_n8n_status || "-"}</p>
            <p>Quando: {caseRecord.last_error_at ? new Date(caseRecord.last_error_at).toLocaleString() : "-"}</p>
          </div>
          <div className="bg-white rounded-md p-3 border border-red-100 text-xs text-gray-700">
            <p className="font-semibold text-gray-800">O que fazer agora</p>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              {nextSteps.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ul>
          </div>
          {effectiveErrorCode === "worker_cpf_conflict" && (
            <Button
              onClick={() => {
                const target = document.getElementById("cadastro-corrections");
                if (target) {
                  target.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              Corrigir dados do cadastro
            </Button>
          )}
        </div>
      )}
      {pppInputDoc && (
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Documento atual</h3>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-900">
                {pppInputDoc.original_name || "PPP enviado"}
              </p>
              {pppInputDoc.created_at && (
                <p className="text-xs text-gray-500">
                  Enviado em {new Date(pppInputDoc.created_at).toLocaleString()}
                </p>
              )}
            </div>
            <DownloadPdfButton slug={slug} caseId={caseId} docId={pppInputDoc.id} />
          </div>
        </div>
      )}
{status === "awaiting_payment" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Pagamento</h3>
          <p className="text-sm text-gray-600">
            Gere o link do Mercado Pago para liberar o processamento do PPP.
          </p>
          <Button onClick={handleCreatePaymentLink} disabled={creatingLink}>
            {creatingLink ? "Gerando..." : "Gerar link de pagamento"}
          </Button>
          {paymentUrl && (
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline text-sm"
            >
              Abrir link de pagamento
            </a>
          )}
          
          {/* Botão DEV para simular pagamento (somente platform_admin + DEV mode) */}
          {showDevTools && (
            <div className="mt-4 pt-4 border-t border-dashed border-orange-300">
              <p className="text-xs text-orange-600 mb-2">
                ????? Modo desenvolvimento (Admin)
              </p>
              <Button
                onClick={handleDevMarkPaid}
                disabled={markingPaid}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {markingPaid ? "Processando..." : "Marcar como pago (DEV)"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Checklist de requisitos */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-4">Checklist</h3>
        <div className="space-y-3">
          {/* Pagamento */}
          <div className="flex items-center gap-3">
            {(status !== "awaiting_payment" || caseRecord.manual_override_paid) ? (
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`text-sm ${status !== "awaiting_payment" ? "text-green-700" : "text-gray-600"}`}>
              {status !== "awaiting_payment" ? "Pagamento confirmado" : "Aguardando pagamento"}
            </span>
          </div>

          {/* PDF */}
          <div className="flex items-center gap-3">
            {hasPppInput ? (
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`text-sm ${hasPppInput ? "text-green-700" : "text-gray-600"}`}>
              {hasPppInput ? "PDF do PPP anexado" : "Aguardando PDF do PPP"}
            </span>
            {hasPppInput && (
              <DownloadPdfButton 
                slug={slug} 
                caseId={caseId} 
                docId={pppInputDoc?.id || ""}
              />
            )}
          </div>

          {/* Envio */}
          <div className="flex items-center gap-3">
            {(status === "processing" || status === "paid_processing" || status === "done") ? (
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
            )}
            <span className={`text-sm ${(status === "processing" || status === "done") ? "text-green-700" : "text-gray-600"}`}>
              {status === "done" ? "Análise concluída" : 
               (status === "processing" || status === "paid_processing") ? "Em processamento" : 
               "Aguardando envio para análise"}
            </span>
          </div>
        </div>
      </div>

      {!analysis && (
        <div id="cadastro-corrections" className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Dados do caso</h3>
              <p className="text-xs text-gray-500">
                Edite os dados do trabalhador e da empresa quando necessário.
              </p>
            </div>
            <Button
              onClick={() => {
                if (editingDetails && caseDetail) {
                  const cadastroWorkerName = caseDetail.worker?.name ?? caseDetail.case.worker?.name ?? "";
                  const cadastroWorkerCpf = caseDetail.worker?.cpf ?? caseDetail.case.worker?.cpf ?? "";
                  const cadastroCompanyName = caseDetail.company?.name ?? caseDetail.case.company?.name ?? "";
                  const cadastroCompanyCnpj = caseDetail.company?.cnpj ?? caseDetail.case.company?.cnpj ?? "";
                  setWorkerNameEdit(cadastroWorkerName);
                  setWorkerCpfEdit(cadastroWorkerCpf);
                  setCompanyNameEdit(cadastroCompanyName);
                  setCompanyCnpjEdit(cadastroCompanyCnpj);
                }
                setEditingDetails((prev) => !prev);
                setDetailsDirty(false);
                setDetailsMessage(null);
              }}
              className="bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              {editingDetails ? "Cancelar edição" : "Editar"}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs text-gray-600">
              Nome do trabalhador
              <input
                value={workerNameEdit}
                onChange={(event) => {
                  setWorkerNameEdit(event.target.value);
                  setDetailsDirty(true);
                }}
                disabled={!editingDetails}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
            </label>
            <label className="text-xs text-gray-600">
              CPF
              <input
                value={workerCpfEdit}
                onChange={(event) => {
                  setWorkerCpfEdit(event.target.value);
                  setDetailsDirty(true);
                }}
                disabled={!editingDetails}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
            </label>
            <label className="text-xs text-gray-600">
              Empresa
              <input
                value={companyNameEdit}
                onChange={(event) => {
                  setCompanyNameEdit(event.target.value);
                  setDetailsDirty(true);
                }}
                disabled={!editingDetails}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
            </label>
            <label className="text-xs text-gray-600">
              CNPJ
              <input
                value={companyCnpjEdit}
                onChange={(event) => {
                  setCompanyCnpjEdit(event.target.value);
                  setDetailsDirty(true);
                }}
                disabled={!editingDetails}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
            </label>
          </div>
          {detailsMessage && (
            <div
              className={`text-xs px-3 py-2 rounded ${
                detailsMessage.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {detailsMessage.text}
            </div>
          )}
          {editingDetails && (
            <div>
              <Button
                onClick={handleSaveDetails}
                disabled={savingDetails || !detailsDirty}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {savingDetails ? "Salvando..." : "Salvar dados"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Upload de PDF - Disponível em awaiting_payment, awaiting_pdf e ready_to_process */}
      {(status === "awaiting_payment" || status === "awaiting_pdf" || status === "ready_to_process") && (
        <div id="ppp-upload-section" className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              status === "awaiting_pdf" ? "bg-blue-100" : "bg-gray-100"
            }`}>
              <svg className={`w-5 h-5 ${status === "awaiting_pdf" ? "text-blue-600" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {hasPppInput ? "PDF do PPP anexado" : "Enviar PDF do PPP"}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {status === "awaiting_payment" 
                  ? "Você pode anexar o PDF agora. O processamento só começa após a confirmação do pagamento."
                  : "O pagamento foi confirmado. Envie o PDF do PPP para iniciar o processamento."
                }
              </p>
            </div>
          </div>

          {/* Mensagem de feedback */}
          {actionMessage && status !== "ready_to_process" && (
            <div className={`p-3 rounded text-sm ${
              actionMessage.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}>
              {actionMessage.text}
            </div>
          )}

          {/* Mostrar PDF anexado */}
          {hasPppInput && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="font-medium text-green-800">PDF anexado com sucesso</p>
                <p className="text-sm text-green-600">
                  {pppInputDoc?.original_name || "ppp_input.pdf"}
                </p>
              </div>
              <div className="flex gap-2">
                <DownloadPdfButton 
                  slug={slug} 
                  caseId={caseId} 
                  docId={pppInputDoc?.id || ""}
                />
              </div>
            </div>
          )}

          {/* área de upload (sempre visível para permitir substituição) */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="cursor-pointer inline-flex flex-col items-center"
            >
              <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-gray-600">
                {selectedFile ? selectedFile.name : (hasPppInput ? "Clique para substituir o PDF" : "Clique para selecionar o PDF")}
              </span>
              <span className="text-xs text-gray-400 mt-1">Apenas arquivos PDF</span>
            </label>
          </div>

          {selectedFile && (
            <div className="flex gap-3">
              <Button
                onClick={handleUploadPdf}
                disabled={uploadingPdf}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {uploadingPdf ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  hasPppInput ? "Substituir PDF" : "Enviar PDF"
                )}
              </Button>
              <Button
                onClick={() => setSelectedFile(null)}
                disabled={uploadingPdf}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Status ready_to_process - Pronto para enviar para análise */}
      {status === "ready_to_process" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-800">Pronto para análise!</h3>
              <p className="text-sm text-green-600 mt-1">
                Pagamento confirmado e PDF anexado. Clique no botão abaixo para enviar para processamento.
              </p>
            </div>
          </div>

          {/* Mensagem de feedback */}
          {actionMessage && (
            <div className={`p-3 rounded text-sm ${
              actionMessage.type === "success"
                ? "bg-green-100 text-green-800 border border-green-300"
                : "bg-red-50 text-red-700"
            }`}>
              {actionMessage.text}
            </div>
          )}

          <Button
            onClick={handleSubmitForAnalysis}
            disabled={submitting || !canSubmitForAnalysis}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base font-medium"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </span>
            ) : !canSubmitForAnalysis ? (
              <span className="flex items-center gap-2">Caso já concluído</span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Enviar para análise
              </span>
            )}
          </Button>
        </div>
      )}

      {(status === "processing" || status === "paid_processing") && !showErrorBanner && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900">PPP em processamento</h3>
              <p className="text-sm text-blue-700 mt-1">
                Seu PPP foi enviado para análise e está sendo processado.
              </p>
              <p className="text-sm text-blue-600 mt-2">
                Aguarde a conclusão. Você será notificado quando o resultado estiver disponível.
                Este processo pode levar alguns minutos.
              </p>
            </div>
          </div>
          
          {/* Botão DEV para anexar PDF fake (somente platform_admin + DEV mode) */}
          {showDevTools && (
            <div className="mt-4 pt-4 border-t border-dashed border-orange-300">
              <p className="text-xs text-orange-600 mb-2">
                ????? Modo desenvolvimento (Admin)
              </p>
              <Button
                onClick={handleDevAttachPdf}
                disabled={attachingPdf}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {attachingPdf ? "Anexando..." : "Anexar PDF fake (DEV)"}
              </Button>
            </div>
          )}
        </div>
      )}

      {status === "done" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-800">PPP Concluído!</h3>
              <p className="text-sm text-green-600 mt-1">
                O processamento foi concluído com sucesso. Baixe o PDF do resultado abaixo.
              </p>
            </div>
          </div>

          {/* Download do PPP output */}
          <div className="flex flex-wrap gap-3">
            {pppOutputDoc ? (
              <DownloadPdfButton 
                slug={slug} 
                caseId={caseId} 
                docId={pppOutputDoc.id}
              />
            ) : signedUrl ? (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium text-sm inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar PDF do PPP
              </a>
            ) : (
              <p className="text-sm text-gray-600">PDF ainda não disponível.</p>
            )}
          </div>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          {hasValidationFailure ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 space-y-3">
              <h3 className="text-sm font-semibold text-yellow-800">FALHA DE VALIDAÇÃO TÉCNICA</h3>
              <p className="text-xs text-yellow-700">
                Não foi possível gerar o parecer por inconsistência ou ausência de dados mínimos.
              </p>
                <ul className="text-xs text-yellow-700 list-disc pl-4 space-y-1">
                  {(validationIssues ?? []).map((issue, index) => (
                    <li key={`validation-${index}`}>{issue}</li>
                  ))}
                </ul>
                <Button
                  onClick={() => {
                    const target = document.getElementById("ppp-upload-section");
                    if (target) {
                      target.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Reenviar PDF
                </Button>
              </div>
          ) : hasVerifierBlock ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-red-800">BLOQUEADO POR CONFLITO</h3>
                <p className="text-xs text-red-600 mt-1">
                  Existe conflito entre dados informados e o documento apresentado.
                </p>
              </div>

                {verifierMustFix.length > 0 && (
                  <div className="bg-white rounded-md p-3 border border-red-100">
                  <p className="text-xs font-semibold text-red-700 mb-2">Itens obrigatorios para corrigir</p>
                  <ul className="text-xs text-red-700 list-disc pl-4 space-y-1">
                    {verifierMustFix.map((item, index) => (
                      <li key={`must-fix-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(verifierIssues) && verifierIssues.length > 0 && (
                <div className="space-y-3">
                  {verifierIssues.map((issue, index) => (
                    <div key={`${issue.field || "field"}-${index}`} className="bg-white rounded-md p-3 border border-red-100">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {issue.field || "Campo não informado"}
                        </p>
                        <SeverityBadge severity={issue.severity} />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{issue.problem || "Problema não informado."}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => {
                  const target = document.getElementById("ppp-upload-section");
                  if (target) {
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reenviar PDF
              </Button>
            </div>
          ) : isReview ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 space-y-2">
              <h3 className="text-sm font-semibold text-orange-800">EM REVISAO</h3>
              <p className="text-xs text-orange-700">
                Recomendamos revisar ou reenviar para melhorar a conferencia.
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-2">
              <h3 className="text-sm font-semibold text-green-800">APROVADO PARA EMISSAO</h3>
              <p className="text-xs text-green-700">Análise concluída sem conflitos críticos.</p>
            </div>
          )}

          {(hasExtractedData || conflictItems.length > 0) && (
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Correções de dados do cadastro</h3>
                <p className="text-xs text-gray-500">
                  Comparacao entre o cadastro do caso e os dados encontrados no documento.
                </p>
              </div>
              {conflictItems.length > 0 ? (
                <div className="space-y-3">
                  {conflictItems.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="border border-red-100 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                        <span className="text-xs font-semibold text-red-700">Divergencia encontrada</span>
                      </div>
                      <div className="mt-2 text-xs text-gray-600 space-y-1">
                        <p>
                          <span className="font-semibold">Cadastro:</span> {item.cadastro}
                        </p>
                        <p>
                          <span className="font-semibold">Documento:</span> {item.extraido}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600">Nenhuma divergencia encontrada.</p>
              )}
            </div>
          )}

                    <div id="cadastro-corrections" className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Correções de dados do cadastro</h3>
                <p className="text-xs text-gray-500">
                  Atualize os dados abaixo caso identifique divergências.
                </p>
              </div>
              <Button
                onClick={() => {
                  if (editingDetails && caseDetail) {
                    const cadastroWorkerName = caseDetail.worker?.name ?? caseDetail.case.worker?.name ?? "";
                    const cadastroWorkerCpf = caseDetail.worker?.cpf ?? caseDetail.case.worker?.cpf ?? "";
                    const cadastroCompanyName = caseDetail.company?.name ?? caseDetail.case.company?.name ?? "";
                    const cadastroCompanyCnpj = caseDetail.company?.cnpj ?? caseDetail.case.company?.cnpj ?? "";
                    setWorkerNameEdit(cadastroWorkerName);
                    setWorkerCpfEdit(cadastroWorkerCpf);
                    setCompanyNameEdit(cadastroCompanyName);
                    setCompanyCnpjEdit(cadastroCompanyCnpj);
                  }
                  setEditingDetails((prev) => !prev);
                  setDetailsDirty(false);
                  setDetailsMessage(null);
                }}
                className="bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                {editingDetails ? "Cancelar edição" : "Editar"}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-gray-600">
                Nome do trabalhador
                <input
                  value={workerNameEdit}
                  onChange={(event) => {
                    setWorkerNameEdit(event.target.value);
                    setDetailsDirty(true);
                  }}
                  disabled={!editingDetails}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
              </label>
              <label className="text-xs text-gray-600">
                CPF
                <input
                  value={workerCpfEdit}
                  onChange={(event) => {
                    setWorkerCpfEdit(event.target.value);
                    setDetailsDirty(true);
                  }}
                  disabled={!editingDetails}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
              </label>
              <label className="text-xs text-gray-600">
                Empresa
                <input
                  value={companyNameEdit}
                  onChange={(event) => {
                    setCompanyNameEdit(event.target.value);
                    setDetailsDirty(true);
                  }}
                  disabled={!editingDetails}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
              </label>
              <label className="text-xs text-gray-600">
                CNPJ
                <input
                  value={companyCnpjEdit}
                  onChange={(event) => {
                    setCompanyCnpjEdit(event.target.value);
                    setDetailsDirty(true);
                  }}
                  disabled={!editingDetails}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
              </label>
            </div>
            {detailsMessage && (
              <div
                className={`text-xs px-3 py-2 rounded ${
                  detailsMessage.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {detailsMessage.text}
              </div>
            )}
            {editingDetails && (
              <div>
                <Button
                  onClick={handleSaveDetails}
                  disabled={savingDetails || !detailsDirty}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {savingDetails ? "Salvando..." : "Salvar correções"}
                </Button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-3">
            {(hasValidationFailure || hasVerifierBlock) && (
              <p className="text-xs text-gray-500">Análise preliminar (pode estar incompleta)</p>
            )}
            <h3 className="text-sm font-semibold text-gray-600">Resumo da análise</h3>
            <p className="text-sm text-gray-800">{analysisSummary || "Resumo não informado."}</p>
            <p className="text-xs text-gray-500">
              Classificação: {getClassificationLabel(finalClassification)}
            </p>
          </div>

          <BlocksList blocks={Array.isArray(analysisBlocks) ? analysisBlocks : []} />
        </div>
      )}

      {status === "error" && !showErrorBanner && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-800">Erro no processamento</h3>
              <p className="text-sm text-red-600 mt-1">
                Ocorreu um erro ao processar o PPP. {hasPppInput ? "Você pode tentar novamente ou solicitar ajuda do suporte." : "Envie o PDF do PPP para tentar novamente."}
              </p>
            </div>
          </div>

          {/* Mensagem de feedback */}
          {actionMessage && (
            <div className={`p-3 rounded text-sm ${
              actionMessage.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}>
              {actionMessage.text}
            </div>
          )}

          {/* Se não tem PDF input, mostrar área de upload */}
          {!hasPppInput && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
                id="pdf-upload-error"
              />
              <label
                htmlFor="pdf-upload-error"
                className="cursor-pointer inline-flex flex-col items-center"
              >
                <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-gray-600">
                  {selectedFile ? selectedFile.name : "Clique para selecionar o PDF"}
                </span>
              </label>
              {selectedFile && (
                <div className="mt-4 flex justify-center gap-3">
                  <Button
                    onClick={handleUploadPdf}
                    disabled={uploadingPdf}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {uploadingPdf ? "Enviando..." : "Enviar PDF"}
                  </Button>
                  <Button
                    onClick={() => setSelectedFile(null)}
                    disabled={uploadingPdf}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Botões de ação - só mostra submit/retry se tem PDF input */}
          <div className="flex flex-wrap gap-3">
            {hasPppInput && (
              <Button
                onClick={handleSubmitForAnalysis}
                disabled={submitting || supportSent || !canSubmitForAnalysis}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  "Tentar novamente"
                )}
              </Button>
            )}

            {!supportSent && !showSupportForm && (
              <Button
                onClick={() => setShowSupportForm(true)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Pedir ajuda ao suporte
              </Button>
            )}

            {supportSent && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Suporte solicitado
              </span>
            )}
          </div>

          {/* Formulário de suporte */}
          {showSupportForm && !supportSent && (
            <div className="border-t pt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Descreva o problema (opcional)
              </label>
              <textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Explique o que aconteceu ou informe detalhes adicionais..."
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <div className="flex gap-3">
                <Button
                  onClick={handleRequestSupport}
                  disabled={requestingSupport}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {requestingSupport ? "Enviando..." : "Enviar para suporte"}
                </Button>
                <Button
                  onClick={() => {
                    setShowSupportForm(false);
                    setSupportMessage("");
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {workflowLogs && workflowLogs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Logs do workflow</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            {workflowLogs.map((log) => (
              <li key={log.id} className="flex items-center justify-between">
                <span>{log.step}</span>
                <span className="text-xs text-gray-500">{log.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
