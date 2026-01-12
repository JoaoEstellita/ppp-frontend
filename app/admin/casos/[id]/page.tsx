"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import {
  adminGetCase,
  adminRetryCase,
  adminGetDocumentDownloadUrl,
  AdminCaseDetail,
  devMarkCaseAsPaid,
  adminResetAwaitingPdf,
  adminListCaseEvents,
  adminSubmitCase,
  adminMarkCaseAsError,
  CaseEvent,
  ApiError,
} from "@/src/services/api";

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

function getStatusBadgeVariant(status: string): "success" | "warning" | "danger" | "info" | "default" {
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

function FeedbackMessageDisplay({ message }: { message: FeedbackMessage | null }) {
  if (!message) return null;
  return (
    <div className={`p-3 rounded text-sm ${
      message.type === "success"
        ? "bg-green-50 text-green-700"
        : "bg-red-50 text-red-700"
    }`}>
      {message.text}
    </div>
  );
}

export default function AdminCaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [caseDetail, setCaseDetail] = useState<AdminCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [caseEvents, setCaseEvents] = useState<CaseEvent[]>([]);

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

  const handleRetry = async () => {
    setActionLoading("retry");
    setMessage(null);
    try {
      const result = await adminRetryCase(caseId);
      setMessage({ type: "success", text: result.message });
      await loadCase();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao reprocessar." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (docId: string, fileName: string) => {
    setActionLoading(`download-${docId}`);
    try {
      const { signedUrl } = await adminGetDocumentDownloadUrl(caseId, docId);
      // Abrir em nova aba
      window.open(signedUrl, "_blank");
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao gerar download." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDevMarkPaid = async () => {
    if (!caseDetail || !caseDetail.case.org_slug) return;
    setActionLoading("mark-paid");
    setMessage(null);
    try {
      const result = await devMarkCaseAsPaid(caseDetail.case.org_slug as string, caseId);
      setMessage({ type: "success", text: result.message || "Fluxo destravado com sucesso!" });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage({ type: "error", text: err.message || "Erro ao destravar fluxo." });
      } else {
        setMessage({ type: "error", text: "Erro ao destravar fluxo." });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitForAnalysis = async () => {
    setActionLoading("submit");
    setMessage(null);
    try {
      const result = await adminSubmitCase(caseId);
      setMessage({ type: "success", text: result.message || "Enviado para análise!" });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage({ type: "error", text: err.message || "Erro ao enviar para análise." });
      } else {
        setMessage({ type: "error", text: "Erro ao enviar para análise." });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetAwaitingPdf = async () => {
    setActionLoading("reset-pdf");
    setMessage(null);
    try {
      const result = await adminResetAwaitingPdf(caseId);
      setMessage({ type: "success", text: result.message });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage({ type: "error", text: err.message || "Erro ao resetar." });
      } else {
        setMessage({ type: "error", text: "Erro ao resetar." });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsError = async () => {
    const reason = window.prompt("Motivo do erro (opcional):", "Sem retorno do n8n - timeout");
    if (reason === null) return; // Cancelou
    
    setActionLoading("mark-error");
    setMessage(null);
    try {
      const result = await adminMarkCaseAsError(caseId, reason || undefined);
      setMessage({ type: "success", text: result.message });
      await loadCase();
      await loadCaseEvents();
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage({ type: "error", text: err.message || "Erro ao marcar como erro." });
      } else {
        setMessage({ type: "error", text: "Erro ao marcar como erro." });
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Verificar se o modo DEV está habilitado
  const isDevModeEnabled = process.env.NEXT_PUBLIC_DEV_MODE === "true";

  // Detectar caso "stuck" (processing sem callback há mais de 15 min)
  const isStuck = (): boolean => {
    if (!caseDetail) return false;
    const caseData = caseDetail.case;
    if (caseData.status !== "processing") return false;
    
    const processingStartedAt = (caseData as Record<string, unknown>).processing_started_at as string | null;
    const lastN8nCallbackAt = (caseData as Record<string, unknown>).last_n8n_callback_at as string | null;
    
    if (!processingStartedAt) return false;
    
    const startedAt = new Date(processingStartedAt);
    const thresholdMs = 15 * 60 * 1000; // 15 minutos
    const now = new Date();
    
    if (now.getTime() - startedAt.getTime() > thresholdMs) {
      if (!lastN8nCallbackAt) return true;
      const callbackAt = new Date(lastN8nCallbackAt);
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
          {STATUS_LABELS[caseData.status] ?? caseData.status}
        </Badge>
      </div>

      {/* Mensagem de feedback */}
      <FeedbackMessageDisplay message={message} />

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
                  <p className="text-xs text-orange-600 mb-2">🛠️ Modo desenvolvimento (Admin)</p>
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

      {/* Status N8N - Painel de Monitoramento */}
      {(caseData.status === "processing" || (caseData as Record<string, unknown>).last_n8n_status) && (
        <div className={`rounded-lg shadow p-6 ${isStuck() ? "bg-amber-50 border-2 border-amber-400" : "bg-white"}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-600">Status N8N</h3>
            {isStuck() && (
              <Badge variant="warning">⚠️ Sem retorno do n8n</Badge>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <span className="text-gray-500">Último Submit:</span>{" "}
              <span className="font-medium">
                {formatDate((caseData as Record<string, unknown>).last_submit_at as string | null)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Tentativas:</span>{" "}
              <span className="font-medium">{(caseData as Record<string, unknown>).submit_attempts ?? 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Status N8N:</span>{" "}
              <span className={`font-medium ${
                (caseData as Record<string, unknown>).last_n8n_status === "success" ? "text-green-600" :
                (caseData as Record<string, unknown>).last_n8n_status === "error" ? "text-red-600" :
                (caseData as Record<string, unknown>).last_n8n_status === "submitted" ? "text-blue-600" :
                "text-gray-600"
              }`}>
                {(caseData as Record<string, unknown>).last_n8n_status ?? "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Início Processing:</span>{" "}
              <span className="font-medium">
                {formatDate((caseData as Record<string, unknown>).processing_started_at as string | null)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Último Callback:</span>{" "}
              <span className="font-medium">
                {formatDate((caseData as Record<string, unknown>).last_n8n_callback_at as string | null)}
              </span>
            </div>
            {(caseData as Record<string, unknown>).last_n8n_error && (
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="text-gray-500">Último Erro N8N:</span>{" "}
                <span className="font-medium text-red-600">
                  {(caseData as Record<string, unknown>).last_n8n_error as string}
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
          {/* Enviar para análise (n8n) */}
          {(caseData.status === "ready_to_process" || caseData.status === "error") && (
            <Button
              onClick={handleSubmitForAnalysis}
              disabled={actionLoading === "submit"}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {actionLoading === "submit" ? "Enviando..." : "Enviar para análise"}
            </Button>
          )}

          {/* Forçar reprocessamento - disponível em processing */}
          {(caseData.status === "processing" || caseData.status === "paid_processing") && (
            <Button
              onClick={handleRetry}
              disabled={actionLoading === "retry"}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {actionLoading === "retry" ? "Reprocessando..." : "Forçar reprocessar"}
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
        </div>

        {/* Aviso sobre override */}
        {isDevModeEnabled && caseData.status === "awaiting_payment" && (
          <p className="mt-3 text-xs text-orange-600">
            ⚠️ Override manual NÃO cria pagamento real e NÃO conta em receita/relatórios.
          </p>
        )}
      </div>

      {/* Erro (se houver) */}
      {caseData.status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800">Erro no processamento</h3>
              {caseData.last_error_message && (
                <p className="text-sm text-red-600 mt-1">{caseData.last_error_message}</p>
              )}
              {caseData.last_error_step && (
                <p className="text-xs text-red-500 mt-1">Etapa: {caseData.last_error_step}</p>
              )}
              {caseData.last_error_at && (
                <p className="text-xs text-red-500">Ocorrido em: {formatDate(caseData.last_error_at)}</p>
              )}
            </div>
            <Button
              onClick={handleRetry}
              disabled={actionLoading === "retry"}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {actionLoading === "retry" ? "Reprocessando..." : "Reprocessar"}
            </Button>
          </div>
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
