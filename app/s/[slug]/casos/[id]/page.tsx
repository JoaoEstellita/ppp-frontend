"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCaseDetail,
  createPaymentLink,
  devMarkCaseAsPaid,
  devAttachFakePdf,
  retryCase,
  requestSupport,
  CaseDetail,
  CaseStatus,
  ApiError,
} from "@/src/services/api";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { supabaseClient } from "@/lib/supabaseClient";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  paid_processing: "Pago / Processando",
  done: "Concluido",
  pending_info: "Pendencias",
  error: "Erro",
};

function getStatusBadgeVariant(status: CaseStatus): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "done":
      return "success";
    case "paid_processing":
      return "info";
    case "awaiting_payment":
      return "warning";
    case "pending_info":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
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
  const [retrying, setRetrying] = useState(false);
  const [requestingSupport, setRequestingSupport] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSent, setSupportSent] = useState(false);
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  // Handler para retry
  const handleRetry = useCallback(async () => {
    if (!slug || !caseId) return;
    try {
      setRetrying(true);
      setActionMessage(null);
      const result = await retryCase(slug, caseId);
      setActionMessage({ type: "success", text: result.message });
      await fetchCase();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionMessage({ type: "error", text: err.message || "Não foi possível reprocessar." });
      } else {
        setActionMessage({ type: "error", text: "Não foi possível reprocessar." });
      }
    } finally {
      setRetrying(false);
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
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
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

      {status === "paid_processing" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">PPP em processamento</h3>
          <p className="text-sm text-gray-600">
            O pagamento foi confirmado. O PDF esta sendo gerado automaticamente.
          </p>
          
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
        <div className="bg-white rounded-lg shadow p-6 space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">PPP concluido</h3>
          {signedUrl ? (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline text-sm"
            >
              Baixar PDF do PPP
            </a>
          ) : (
            <p className="text-sm text-gray-600">PDF ainda nao disponivel.</p>
          )}
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
                Ocorreu um erro ao processar o PPP. Você pode tentar novamente ou solicitar ajuda do suporte.
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

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleRetry}
              disabled={retrying || supportSent}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {retrying ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Reprocessando...
                </span>
              ) : (
                "Tentar novamente"
              )}
            </Button>

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
