"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ResultSummaryCard } from "@/components/ResultSummaryCard";
import {
  adminGetCase,
  adminGetDocumentDownloadUrl,
  adminUpdateCaseDetails,
  AdminCaseDetail,
  ApiError,
  devMarkCaseAsPaid,
  adminResetAwaitingPdf,
  adminListCaseEvents,
  adminSubmitCase,
  adminMarkCaseAsError,
  adminUploadPppInput,
  adminResendPublicEmail,
  CaseEvent,
} from "@/src/services/api";

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  awaiting_pdf: "Aguardando PDF",
  ready_to_process: "Pronto para análise",
  processing: "Processando",
  paid_processing: "Pago / Processando",
  done: "Concluído",
  done_warning: "Concluído com alerta",
  pending_info: "Pendências",
  error: "Erro",
};

function getStatusBadgeVariant(status: string): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "done":
      return "success";
    case "done_warning":
      return "warning";
    case "processing":
    case "paid_processing":
      return "info";
    case "ready_to_process":
      return "success";
    case "awaiting_payment":
    case "awaiting_pdf":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

type FeedbackMessage = { type: "success" | "error"; text: string };

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function formatCpf(value: string | null | undefined): string {
  const v = digitsOnly(value).slice(0, 11);
  if (v.length <= 3) return v;
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
}

function formatCnpj(value: string | null | undefined): string {
  const v = digitsOnly(value).slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

function hasSubmitProgress(
  before: AdminCaseDetail | null | undefined,
  after: AdminCaseDetail | null | undefined
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

function isTransientGatewaySubmitState(caseData: AdminCaseDetail["case"] | null | undefined): boolean {
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

export default function AdminCaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [caseDetail, setCaseDetail] = useState<AdminCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [caseEvents, setCaseEvents] = useState<CaseEvent[]>([]);
  const [reuploading, setReuploading] = useState(false);
  const [reuploadMessage, setReuploadMessage] = useState<FeedbackMessage | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    workerName: "",
    workerCpf: "",
    companyName: "",
    companyCnpj: "",
  });

  const loadCaseEvents = useCallback(async () => {
    if (!caseId) return;
    try {
      const events = await adminListCaseEvents(caseId, 30);
      setCaseEvents(events);
    } catch {
      // Silenciar erro - não é crítico
    }
  }, [caseId]);

  const loadCase = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminGetCase(caseId);
      setCaseDetail(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar caso.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadCase();
    loadCaseEvents();
  }, [loadCase, loadCaseEvents]);

  useEffect(() => {
    setDetailsForm({
      workerName: String(caseDetail?.worker?.name ?? ""),
      workerCpf: formatCpf(caseDetail?.worker?.cpf ?? ""),
      companyName: String(caseDetail?.company?.name ?? ""),
      companyCnpj: formatCnpj(caseDetail?.company?.cnpj ?? ""),
    });
  }, [caseDetail?.worker?.name, caseDetail?.worker?.cpf, caseDetail?.company?.name, caseDetail?.company?.cnpj]);

  // Polling automático quando caso está em processing (a cada 10 segundos)
  useEffect(() => {
    const status = caseDetail?.case?.status;
    const transientGatewaySubmit = isTransientGatewaySubmitState(caseDetail?.case as AdminCaseDetail["case"] | null);
    if (status !== "processing" && status !== "paid_processing" && !transientGatewaySubmit) return;

    const interval = setInterval(() => {
      loadCase();
      loadCaseEvents();
    }, 10000); // 10 segundos

    return () => clearInterval(interval);
  }, [
    caseDetail?.case?.status,
    caseDetail?.case?.last_n8n_status,
    caseDetail?.case?.last_n8n_error,
    caseDetail?.case?.last_n8n_callback_at,
    caseDetail?.case?.last_submit_at,
    caseDetail?.case,
    loadCase,
    loadCaseEvents,
  ]);

  const handleDownload = async (docId: string, fileName: string) => {
    setActionLoading(`download-${docId}`);
    try {
      const { signedUrl } = await adminGetDocumentDownloadUrl(caseId, docId);
      // Abrir em nova aba
      window.open(signedUrl, "_blank");
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDevMarkPaid = async () => {
    if (!caseDetail || !caseDetail.case.org_slug) return;
    setActionLoading("mark-paid");
    setFeedback(null);
    try {
      const result = await devMarkCaseAsPaid(caseDetail.case.org_slug as string, caseId);
      setFeedback({ type: "success", text: String(result?.message ?? "Fluxo destravado com sucesso!") });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitForAnalysis = async () => {
    const isFinalized = caseDetail?.case?.status === "done" || caseDetail?.case?.status === "done_warning";
    if (isFinalized) {
      const confirmed = window.confirm(
        "Este caso já está concluído. Deseja revalidar no n8n como admin? O resultado anterior será substituído."
      );
      if (!confirmed) return;
    }

    setActionLoading("submit");
    setFeedback(null);
    const snapshotBeforeSubmit = caseDetail;
    try {
      const result = await adminSubmitCase(caseId, { forceReprocess: isFinalized });
      setFeedback({ type: "success", text: String(result?.message ?? "Enviado para análise!") });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && String(err.message || "").toLowerCase().includes("conclu")) {
        setFeedback({ type: "error", text: "Caso já foi concluído. Não é possível reprocessar." });
        await loadCase();
        await loadCaseEvents();
        return;
      }

      if (isTransientSubmitError(err)) {
        setFeedback({
          type: "success",
          text: "Envio recebido pelo backend e em validação. Aguarde alguns segundos enquanto confirmamos o status.",
        });
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            const latest = await adminGetCase(caseId);
            setCaseDetail(latest);
            await loadCaseEvents();
            if (hasSubmitProgress(snapshotBeforeSubmit, latest)) {
              setFeedback({
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
        setFeedback({
          type: "success",
          text: "Envio em validação. Se o status não atualizar em até 1 minuto, tente reenviar.",
        });
        return;
      }

      setFeedback({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetAwaitingPdf = async () => {
    setActionLoading("reset-pdf");
    setFeedback(null);
    try {
      const result = await adminResetAwaitingPdf(caseId);
      setFeedback({ type: "success", text: String(result?.message ?? "Resetado com sucesso!") });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendPublicEmail = async () => {
    if (!caseId) return;
    setActionLoading("resend-public-email");
    setFeedback(null);
    try {
      const result = await adminResendPublicEmail(caseId);
      setFeedback({ type: "success", text: String(result?.message ?? "Email reenviado com sucesso.") });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionLoading(null);
    }
  };
  const handleReuploadFile = async (file: File) => {
    if (!caseId) return;
    try {
      setReuploading(true);
      setReuploadMessage(null);
      await adminUploadPppInput(caseId, file);
      setReuploadMessage({ type: "success", text: "PPP reenviado. Processamento reiniciado." });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      setReuploadMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Não foi possível reenviar o PPP.",
      });
    } finally {
      setReuploading(false);
    }
  };

  const handleMarkAsError = async () => {
    const reason = window.prompt("Motivo do erro (opcional):", "Sem retorno do n8n - timeout");
    if (reason === null) return; // Cancelou
    
    setActionLoading("mark-error");
    setFeedback(null);
    try {
      const result = await adminMarkCaseAsError(caseId, reason || undefined);
      setFeedback({ type: "success", text: String(result?.message ?? "Marcado como erro!") });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveDetails = async () => {
    if (!caseId) return;
    const workerName = detailsForm.workerName.trim();
    const workerCpf = digitsOnly(detailsForm.workerCpf);
    const companyName = detailsForm.companyName.trim();
    const companyCnpj = digitsOnly(detailsForm.companyCnpj);

    if (!workerName || workerCpf.length !== 11 || !companyName || companyCnpj.length !== 14) {
      setFeedback({
        type: "error",
        text: "Preencha Nome/CPF/Empresa/CNPJ corretamente antes de salvar.",
      });
      return;
    }

    setDetailsSaving(true);
    setFeedback(null);
    try {
      await adminUpdateCaseDetails(caseId, {
        workerName,
        workerCPF: workerCpf,
        companyName,
        companyCNPJ: companyCnpj,
      });
      setEditingDetails(false);
      setFeedback({ type: "success", text: "Dados atualizados com sucesso." });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setDetailsSaving(false);
    }
  };

  // Verificar se o modo DEV está habilitado
  const isDevModeEnabled = process.env.NEXT_PUBLIC_DEV_MODE === "true";

  // Detectar caso "stuck" (processing sem callback há mais de 15 min)
  const isStuck = (): boolean => {
    if (!caseDetail) return false;
    const caseData = caseDetail.case;
    if (caseData.status !== "processing") return false;
    
    if (!caseData.processing_started_at) return false;
    
    const startedAt = new Date(caseData.processing_started_at);
    const thresholdMs = 15 * 60 * 1000; // 15 minutos
    const now = new Date();
    
    if (now.getTime() - startedAt.getTime() > thresholdMs) {
      if (!caseData.last_n8n_callback_at) return true;
      const callbackAt = new Date(caseData.last_n8n_callback_at);
      if (callbackAt < startedAt) return true;
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !caseDetail) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{error || "Caso não encontrado."}</p>
        <Button onClick={() => router.push("/admin/casos")} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const { case: caseData, worker, company, documents, analysis, payment, supportRequest, workflowLogs } = caseDetail;
  const pppInputDoc = documents.find((doc) => doc.document_type === "ppp_input");
  const pppOutputDoc = documents.find(
    (doc) => doc.document_type === "ppp_result" || doc.document_type === "ppp_output"
  );
  const errorCode = String(caseData.last_error_code ?? "").toLowerCase();
  const hasDivergence = errorCode === "conflict_detected" || Boolean((caseData as any).has_divergence);
  const errorMessage =
    caseData.last_error_message ||
    (errorCode === "ocr_size_limit"
      ? "O arquivo enviado é muito grande para leitura automatizada (limite 5MB). Reenvie um PDF menor ou comprimido."
      : errorCode === "download_failed"
      ? "Falha ao baixar o PDF enviado. Reenvie o arquivo."
      : errorCode === "ocr_failed"
      ? "Falha na leitura do documento. Reenvie o PDF com melhor qualidade."
      : errorCode === "conflict_detected"
      ? "Há divergências entre cadastro e documento."
      : errorCode === "validation_failed"
      ? "Falha de validação técnica. Verifique os dados e reenvie o PPP."
      : "");
  const transientGatewaySubmit = isTransientGatewaySubmitState(caseData);
  const effectiveN8nStatus = transientGatewaySubmit ? "submitted" : caseData.last_n8n_status;
  const effectiveN8nError = transientGatewaySubmit ? null : caseData.last_n8n_error;
  const adminNextActions = (() => {
    if (transientGatewaySubmit) {
      return [
        "Aguardar callback final do n8n para confirmar status.",
        "Evitar novo reenvio antes do callback para nao duplicar processamento.",
      ];
    }
    if (caseData.status === "error") {
      return [
        "Revisar codigo/mensagem de erro no painel.",
        "Corrigir cadastro ou reenviar PDF conforme causa.",
        "Se necessario, reenviar para analise manualmente.",
      ];
    }
    if (caseData.status === "processing" || caseData.status === "paid_processing") {
      return ["Acompanhar retorno do callback e fila do n8n."];
    }
    if (pppOutputDoc) {
      return ["Conferir resultado final e encerrar atendimento."];
    }
    return ["Monitorar status e eventos do caso."];
  })();

  // Variável intermediária com tipo explícito para evitar erro de inferência unknown
  const feedbackNode: React.ReactNode = (() => {
    const fb = feedback;
    if (!fb) return null;

    const cls =
      fb.type === "success"
        ? "bg-green-50 text-green-700"
        : "bg-red-50 text-red-700";

    return (
      <div className={`p-3 rounded text-sm ${cls}`}>
        {fb.text}
      </div>
    );
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push("/admin/casos")}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            ← Voltar
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Caso {caseData.id.slice(0, 8)}...</h2>
            <p className="text-sm text-gray-500">
              {caseData.org_name} ({caseData.org_slug})
            </p>
          </div>
        </div>
        <Badge variant={getStatusBadgeVariant(caseData.status)}>
          {String(STATUS_LABELS[caseData.status] ?? caseData.status)}
        </Badge>
      </div>

      {/* Mensagem de feedback */}
      {feedbackNode}

      <ResultSummaryCard
        audience="admin"
        status={caseData.status}
        finalClassification={analysis?.final_classification ?? null}
        summary={caseData.last_error_message || null}
        validationOk={null}
        validationIssues={[]}
        verifierRisk={null}
        verifierIssues={[]}
        resultAvailable={Boolean(pppOutputDoc)}
        lastErrorMessage={transientGatewaySubmit ? null : errorMessage || null}
        nextActions={adminNextActions}
        updatedAt={caseData.updated_at || null}
      />

      {/* Grid de informações */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Trabalhador */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Trabalhador</h3>
          <p className="text-lg font-medium text-gray-900">{worker?.name || "-"}</p>
          <p className="text-sm text-gray-600">CPF: {worker?.cpf || "-"}</p>
          {worker?.birth_date && (
            <p className="text-sm text-gray-600">Nascimento: {formatDate(worker.birth_date)}</p>
          )}
        </div>

        {/* Empresa */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Empresa</h3>
          <p className="text-lg font-medium text-gray-900">{company?.name || "-"}</p>
          <p className="text-sm text-gray-600">CNPJ: {company?.cnpj || "-"}</p>
        </div>

        {/* Status e Datas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Informações do Caso</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">Status:</span> {STATUS_LABELS[caseData.status] ?? caseData.status}</p>
            <p><span className="text-gray-500">Criado em:</span> {formatDate(caseData.created_at)}</p>
            <p><span className="text-gray-500">Atualizado em:</span> {formatDate(caseData.updated_at)}</p>
            <p><span className="text-gray-500">Email do trabalhador:</span> {caseData.user_email || "-"}</p>
            <p><span className="text-gray-500">Retries:</span> {caseData.retry_count}</p>
          </div>
        </div>

        {/* Pagamento */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Pagamento</h3>
          {payment ? (
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Status:</span> {payment.status}</p>
              <p><span className="text-gray-500">Valor:</span> R$ {payment.amount?.toFixed(2) ?? "-"}</p>
              <p><span className="text-gray-500">Pago em:</span> {formatDate(payment.paid_at)}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Nenhum pagamento registrado.</p>
              {/* Botão DEV para marcar como pago */}
              {isDevModeEnabled && caseData.status === "awaiting_payment" && (
                <div className="pt-3 border-t border-dashed border-orange-300">
                  <p className="text-xs text-orange-600 mb-2">Modo desenvolvimento (Admin)</p>
                  <Button
                    onClick={handleDevMarkPaid}
                    disabled={actionLoading === "mark-paid"}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {actionLoading === "mark-paid" ? "Processando..." : "Marcar como pago (DEV)"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Dados do cadastro</h3>
          <Button
            onClick={() => setEditingDetails((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {editingDetails ? "Cancelar" : "Editar dados"}
          </Button>
        </div>
        <p className="text-sm text-gray-500">
          {caseData.status === "error" || hasDivergence
            ? "Atualize os dados para reduzir divergências no processamento."
            : "Edite os dados do trabalhador e da empresa quando necessário."}
        </p>

        {editingDetails && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Nome do trabalhador</span>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={detailsForm.workerName}
                onChange={(e) => setDetailsForm((prev) => ({ ...prev, workerName: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">CPF</span>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={detailsForm.workerCpf}
                onChange={(e) => setDetailsForm((prev) => ({ ...prev, workerCpf: formatCpf(e.target.value) }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">Empresa</span>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={detailsForm.companyName}
                onChange={(e) => setDetailsForm((prev) => ({ ...prev, companyName: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600">CNPJ</span>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2"
                value={detailsForm.companyCnpj}
                onChange={(e) => setDetailsForm((prev) => ({ ...prev, companyCnpj: formatCnpj(e.target.value) }))}
              />
            </label>
            <div className="sm:col-span-2 pt-2">
              <Button
                onClick={handleSaveDetails}
                disabled={detailsSaving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {detailsSaving ? "Salvando..." : "Salvar correções"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Status N8N - Painel de Monitoramento */}
      {(caseData.status === "processing" || caseData.last_n8n_status) && (
        <div className={`rounded-lg shadow p-6 ${isStuck() ? "bg-amber-50 border-2 border-amber-400" : "bg-white"}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-600">Status N8N</h3>
            {isStuck() && (
              <Badge variant="warning">Sem retorno do n8n</Badge>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <span className="text-gray-500">Último Submit:</span>{" "}
              <span className="font-medium">
                {formatDate(caseData.last_submit_at)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Tentativas:</span>{" "}
              <span className="font-medium">{caseData.submit_attempts ?? 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Status N8N:</span>{" "}
              <span className={`font-medium ${
                effectiveN8nStatus === "success" ? "text-green-600" :
                effectiveN8nStatus === "error" ? "text-red-600" :
                effectiveN8nStatus === "submitted" ? "text-blue-600" :
                "text-gray-600"
              }`}>
                {effectiveN8nStatus ?? "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Início Processing:</span>{" "}
              <span className="font-medium">
                {formatDate(caseData.processing_started_at)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Último Callback:</span>{" "}
              <span className="font-medium">
                {formatDate(caseData.last_n8n_callback_at)}
              </span>
            </div>
            {effectiveN8nError && (
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="text-gray-500">Último Erro N8N:</span>{" "}
                <span className="font-medium text-red-600">
                  {effectiveN8nError}
                </span>
              </div>
            )}
            {transientGatewaySubmit && (
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="font-medium text-blue-700">
                  Envio em validação: execução iniciada, aguardando callback final do n8n.
                </span>
              </div>
            )}
          </div>
          
          {/* Ações para casos stuck */}
          {isStuck() && (
            <div className="mt-4 pt-4 border-t border-amber-300 flex flex-wrap gap-3">
              <Button
                onClick={handleSubmitForAnalysis}
                disabled={actionLoading === "submit"}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {actionLoading === "submit" ? "Reenviando..." : "Reenviar para análise"}
              </Button>
              <Button
                onClick={handleMarkAsError}
                disabled={actionLoading === "mark-error"}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {actionLoading === "mark-error" ? "Marcando..." : "Marcar como erro"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Ações Admin - sempre visíveis para facilitar acesso rápido */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-4">Ações Admin</h3>
        <div className="flex flex-wrap gap-3">
          {/* Enviar/Reenviar para análise (n8n) */}
          {(caseData.status === "ready_to_process" ||
            caseData.status === "error" ||
            caseData.status === "done" ||
            caseData.status === "done_warning") && (
            <Button
              onClick={handleSubmitForAnalysis}
              disabled={actionLoading === "submit"}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {actionLoading === "submit"
                ? "Enviando..."
                : (caseData.status === "done" || caseData.status === "done_warning")
                  ? "Revalidar no N8N (Admin)"
                  : "Enviar para análise (N8N)"}
            </Button>
          )}

          {/* Em processing: mostrar que está aguardando retorno */}
          {(caseData.status === "processing" || caseData.status === "paid_processing") && !isStuck() && (
            <Button
              disabled={true}
              className="bg-gray-400 text-white cursor-not-allowed"
            >
              Aguardando retorno do N8N...
            </Button>
          )}

          {/* Destravar como pago (Override) */}
          {isDevModeEnabled && caseData.status === "awaiting_payment" && (
            <Button
              onClick={handleDevMarkPaid}
              disabled={actionLoading === "mark-paid"}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {actionLoading === "mark-paid" ? "Processando..." : "Destravar como pago (Override)"}
            </Button>
          )}

          {/* Resetar para aguardando PDF */}
          {(caseData.status === "error" || caseData.status === "processing") && (
            <Button
              onClick={handleResetAwaitingPdf}
              disabled={actionLoading === "reset-pdf"}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              {actionLoading === "reset-pdf" ? "Resetando..." : "Resetar para aguardando PDF"}
            </Button>
          )}

          {/* Reenviar email para trabalhador (B2C) */}
          <Button
            onClick={handleResendPublicEmail}
            disabled={actionLoading === "resend-public-email"}
            title={caseData.user_email ? undefined : "Email principal ausente; backend tentará fallback pelos eventos do caso."}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {actionLoading === "resend-public-email" ? "Enviando..." : "Reenviar email do trabalhador"}
          </Button>
        </div>

        {/* Aviso sobre override */}
        {isDevModeEnabled && caseData.status === "awaiting_payment" && (
          <p className="mt-3 text-xs text-orange-600">
            Override manual NÃO cria pagamento real e NÃO conta em receita/relatórios.
          </p>
        )}
      </div>

      {/* Erro (se houver) */}
      {caseData.status === "error" && !transientGatewaySubmit && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800">Erro no processamento</h3>
              {errorMessage && (
                <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
              )}
              {caseData.last_error_step && (
                <p className="text-xs text-red-500 mt-1">Etapa: {caseData.last_error_step}</p>
              )}
              {caseData.last_error_at && (
                <p className="text-xs text-red-500">Ocorrido em: {formatDate(caseData.last_error_at)}</p>
              )}
              <div className="mt-3 text-xs text-gray-700 bg-white border border-red-100 rounded p-3">
                <p className="font-semibold text-gray-800">Último problema</p>
                <p>Código: {caseData.last_error_code || "-"}</p>
                <p>Mensagem: {caseData.last_error_message || "-"}</p>
                <p>Etapa: {caseData.last_error_step || "-"}</p>
                <p>Status N8N: {caseData.last_n8n_status || "-"}</p>
                <p>Quando: {caseData.last_error_at ? formatDate(caseData.last_error_at) : "-"}</p>
              </div>
            </div>
            <div className="space-y-2">
                <input
                  id="admin-ppp-reupload"
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
                    const input = document.getElementById("admin-ppp-reupload") as HTMLInputElement | null;
                    input?.click();
                  }}
                  disabled={reuploading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {reuploading ? "Reenviando..." : "Reenviar PDF"}
                </Button>
                {reuploadMessage && (
                  <p className={`text-xs ${reuploadMessage.type === "success" ? "text-green-700" : "text-red-600"}`}>
                    {reuploadMessage.text}
                  </p>
                )}
              </div>
              <Button
                onClick={handleSubmitForAnalysis}
                disabled={actionLoading === "submit"}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {actionLoading === "submit" ? "Reenviando..." : "Reenviar para análise"}
              </Button>
          </div>
        </div>
      )}

      {transientGatewaySubmit && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-800">Envio em validação</h3>
          <p className="text-sm text-blue-700 mt-1">
            O backend recebeu erro transitório de gateway, mas o n8n já foi acionado. Aguarde o callback para status final.
          </p>
        </div>
      )}

      {/* Suporte Request */}
      {supportRequest && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-orange-800 mb-2">Solicitação de Suporte</h3>
          <div className="space-y-1 text-sm">
            <p><span className="text-orange-600">Status:</span> {supportRequest.status}</p>
            <p><span className="text-orange-600">Criado em:</span> {formatDate(supportRequest.created_at)}</p>
            {supportRequest.message && (
              <p className="text-orange-700 mt-2 italic">&quot;{supportRequest.message}&quot;</p>
            )}
            {supportRequest.resolved_at && (
              <p><span className="text-orange-600">Resolvido em:</span> {formatDate(supportRequest.resolved_at)}</p>
            )}
          </div>
        </div>
      )}

      {pppInputDoc && (
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-600">Documento atual</h3>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {pppInputDoc.original_name || "ppp_input.pdf"}
              </p>
              <p className="text-xs text-gray-500">
                Enviado em {formatDate(pppInputDoc.created_at)}
              </p>
            </div>
            <button
              onClick={() => handleDownload(pppInputDoc.id, pppInputDoc.original_name || "ppp_input.pdf")}
              disabled={actionLoading === `download-${pppInputDoc.id}`}
              className="px-3 py-1 text-sm font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 transition-colors"
            >
              {actionLoading === `download-${pppInputDoc.id}` ? "..." : "Baixar PPP enviado"}
            </button>
          </div>
        </div>
      )}

      {/* Documentos */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-4">Documentos</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum documento anexado.</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{doc.original_name || doc.document_type}</p>
                  <p className="text-xs text-gray-500">
                    Tipo: {doc.document_type} • Criado em: {formatDate(doc.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(doc.id, doc.original_name || "documento.pdf")}
                  disabled={actionLoading === `download-${doc.id}`}
                  className="px-3 py-1 text-sm font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === `download-${doc.id}` ? "..." : "Baixar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Análise */}
      {analysis && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Análise</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">ID:</span> {analysis.id}</p>
            <p><span className="text-gray-500">Classificação:</span> {analysis.final_classification || "-"}</p>
            <p><span className="text-gray-500">Criado em:</span> {formatDate(analysis.created_at)}</p>
          </div>
        </div>
      )}

      {/* Workflow Logs */}
      {workflowLogs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Logs do Workflow</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {workflowLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    log.status === "DONE" ? "bg-green-500" :
                    log.status === "ERROR" ? "bg-red-500" : "bg-yellow-500"
                  }`} />
                  <span className="font-medium text-gray-900">{log.step}</span>
                  {log.message && (
                    <span className="text-gray-500">- {log.message}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de Eventos (Auditoria) */}
      {caseEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Histórico de Eventos (Auditoria)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {caseEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between text-sm p-3 bg-gray-50 rounded"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      event.type === "manual_override_paid" ? "bg-orange-100 text-orange-700" :
                      event.type === "admin_retry" || event.type === "bulk_admin_retry" ? "bg-blue-100 text-blue-700" :
                      event.type === "processing_completed" ? "bg-green-100 text-green-700" :
                      event.type === "processing_failed" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {event.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  {event.payload && Object.keys(event.payload).length > 0 && (
                    <p className="text-xs text-gray-500 mt-1 truncate max-w-md" title={JSON.stringify(event.payload)}>
                      {JSON.stringify(event.payload).substring(0, 80)}...
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-3">{formatDate(event.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}












