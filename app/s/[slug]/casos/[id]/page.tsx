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

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  awaiting_pdf: "Aguardando PDF",
  ready_to_process: "Pronto para análise",
  processing: "Processando",
  paid_processing: "Pago / Processando",
  done: "Concluido",
  pending_info: "Pendencias",
  error: "Erro",
};

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
        setError(err.message || "Nao foi possivel carregar o caso.");
      } else {
        setError("Nao foi possivel carregar o caso.");
      }
    } finally {
      setLoading(false);
    }
  }, [slug, caseId]);

  // Effect para carregar o caso
  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  // Derivar downloadUrl de caseDetail (memoizado para evitar recálculos)
  const downloadUrl = useMemo(() => {
    if (!caseDetail) return undefined;
    const pdfDoc = (caseDetail.case.documents ?? []).find((doc) =>
      String(doc.type).toLowerCase().includes("ppp")
    );
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
      setError("Nao foi possivel gerar o link de pagamento.");
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
        setError(err.message || "Nao foi possivel marcar como pago.");
      } else {
        setError("Nao foi possivel marcar como pago.");
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
        setError(err.message || "Nao foi possivel anexar o PDF.");
      } else {
        setError("Nao foi possivel anexar o PDF.");
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

  // Handler para enviar para análise (n8n)
  const handleSubmitForAnalysis = useCallback(async () => {
    if (!slug || !caseId) return;
    try {
      setSubmitting(true);
      setActionMessage(null);
      const result = await submitCase(slug, caseId);
      if (result.ok) {
        setActionMessage({ type: "success", text: result.message || "Enviado para análise!" });
        await fetchCase();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setActionMessage({ type: "error", text: err.message || "Não foi possível enviar para análise." });
      } else {
        setActionMessage({ type: "error", text: "Não foi possível enviar para análise." });
      }
    } finally {
      setSubmitting(false);
    }
  }, [slug, caseId, fetchCase]);

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

  // Verificar se tem documento PPP input
  const hasPppInput = useMemo(() => {
    return caseDocuments.some(doc => doc.document_type === "ppp_input");
  }, [caseDocuments]);

  // Verificar se tem documento PPP output (resultado final)
  const pppOutputDoc = useMemo(() => {
    return caseDocuments.find(doc => doc.document_type === "ppp_output");
  }, [caseDocuments]);

  // Verificar se pode enviar para análise
  const canSubmitForAnalysis = useMemo(() => {
    const status = caseDetail?.case.status as CaseStatus;
    return (status === "ready_to_process" || status === "error") && hasPppInput;
  }, [caseDetail?.case.status, hasPppInput]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Caso #{caseRecord.id}</h2>
        <Badge variant={getStatusBadgeVariant(status)}>{statusLabel}</Badge>
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
                🛠️ Modo desenvolvimento (Admin)
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
                docId={caseDocuments.find(d => d.document_type === "ppp_input")?.id || ""}
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

      {/* Upload de PDF - Disponível em awaiting_payment, awaiting_pdf e ready_to_process */}
      {(status === "awaiting_payment" || status === "awaiting_pdf" || status === "ready_to_process") && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
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
          {actionMessage && (
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
                  {caseDocuments.find(d => d.document_type === "ppp_input")?.original_name || "ppp_input.pdf"}
                </p>
              </div>
              <div className="flex gap-2">
                <DownloadPdfButton 
                  slug={slug} 
                  caseId={caseId} 
                  docId={caseDocuments.find(d => d.document_type === "ppp_input")?.id || ""}
                />
              </div>
            </div>
          )}

          {/* Área de upload (sempre visível para permitir substituição) */}
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
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base font-medium"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </span>
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

      {(status === "processing" || status === "paid_processing") && (
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
                🛠️ Modo desenvolvimento (Admin)
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

      {status === "error" && (
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
                disabled={submitting || supportSent}
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
