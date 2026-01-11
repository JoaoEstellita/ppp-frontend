"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCaseDetail,
  createPaymentLink,
  CaseDetail,
  CaseStatus,
  ApiError,
} from "@/src/services/api";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { supabaseClient } from "@/lib/supabaseClient";

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
        const { data } = await supabaseClient.storage
          .from("ppp-docs")
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
        </div>
      )}

      {status === "paid_processing" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">PPP em processamento</h3>
          <p className="text-sm text-gray-600">
            O pagamento foi confirmado. O PDF esta sendo gerado automaticamente.
          </p>
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Ocorreu um erro ao gerar o PPP. Verifique as notificacoes.
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
