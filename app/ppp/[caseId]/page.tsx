"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ApiError,
  createPublicPayment,
  getPublicCase,
  getPublicResultDownload,
  reuploadPublicPpp,
} from "@/src/services/api";
import { Button } from "@/components/Button";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function formatStatus(status?: string | null) {
  switch (status) {
    case "awaiting_payment":
      return "Aguardando pagamento";
    case "awaiting_pdf":
      return "Aguardando PDF";
    case "ready_to_process":
      return "Pronto para processamento";
    case "processing":
    case "paid_processing":
      return "Processando";
    case "done":
      return "Concluído";
    case "error":
      return "Erro";
    default:
      return status || "-";
  }
}

function resolvePublicErrorMessage(code?: string | null, message?: string | null) {
  if (message) return message;
  switch (code) {
    case "download_failed":
      return "Falha ao baixar o documento. Reenvie o PDF.";
    case "ocr_failed":
      return "Falha na leitura do documento. Reenvie o PDF.";
    case "ocr_size_limit":
      return "Arquivo muito grande para leitura automática. Reenvie um PDF menor.";
    case "validation_failed":
      return "Falha de validação técnica. Reenvie o PDF com dados corretos.";
    case "conflict_detected":
      return "Há divergências entre cadastro e documento. Revise e reenvie.";
    default:
      return "Erro no processamento. Tente reenviar o PDF.";
  }
}

function formatPaymentStatus(status?: string | null) {
  switch (status) {
    case "approved":
      return "Confirmado";
    case "pending":
      return "Pendente";
    case "in_process":
      return "Em processamento";
    case "rejected":
      return "Rejeitado";
    default:
      return status || "pendente";
  }
}

function paymentBadgeClass(status?: string | null) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    case "in_process":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function PublicCaseStatusPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const caseId = params?.caseId as string | undefined;

  const [caseDetail, setCaseDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reuploading, setReuploading] = useState(false);
  const [reuploadError, setReuploadError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [downloadingResult, setDownloadingResult] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fetchCase = useCallback(async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getPublicCase(caseId);
      setCaseDetail(data);
      setPaymentUrl(data?.payment?.payment_url ?? null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Não foi possível carregar o caso.");
      } else {
        setError("Não foi possível carregar o caso.");
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  useEffect(() => {
    const status = caseDetail?.case?.status;
    if (status !== "processing" && status !== "paid_processing") return;
    const timer = setInterval(fetchCase, 10000);
    return () => clearInterval(timer);
  }, [caseDetail?.case?.status, fetchCase]);

  const lastErrorCode = caseDetail?.case?.last_error_code ?? null;
  const lastErrorMessage = caseDetail?.case?.last_error_message ?? null;
  const lastErrorStep = caseDetail?.case?.last_error_step ?? null;

  const showErrorBanner =
    caseDetail?.case?.status === "error" ||
    !!lastErrorCode ||
    !!lastErrorMessage;

  const handleReupload = async (file: File) => {
    if (!caseId) return;
    setReuploading(true);
    setReuploadError(null);
    try {
      await reuploadPublicPpp(caseId, file);
      await fetchCase();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 413) {
          setReuploadError("Arquivo muito grande. Envie um PDF menor.");
        } else {
          setReuploadError(err.message || "Não foi possível reenviar o PDF.");
        }
      } else {
        setReuploadError("Não foi possível reenviar o PDF.");
      }
    } finally {
      setReuploading(false);
    }
  };

  const handlePayment = async () => {
    if (!caseId) return;
    setCreatingPayment(true);
    setError(null);
    try {
      const payment = await createPublicPayment(caseId);
      if (payment?.payment_url) {
        window.location.href = payment.payment_url;
        return;
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError("Pagamento já iniciado para este caso.");
        } else {
          setError(err.message || "Não foi possível gerar o link de pagamento.");
        }
      } else {
        setError("Não foi possível gerar o link de pagamento.");
      }
    } finally {
      setCreatingPayment(false);
    }
  };

  const statusLabel = useMemo(
    () => formatStatus(caseDetail?.case?.status),
    [caseDetail?.case?.status]
  );
  const paymentStatus = caseDetail?.payment?.status || null;
  const resultDoc = useMemo(() => {
    const docs = caseDetail?.case?.documents ?? [];
    return (
      docs.find((doc: any) => doc.document_type === "ppp_result" || doc.type === "ppp_result") ||
      docs.find((doc: any) => doc.document_type === "ppp_output" || doc.type === "ppp_output") ||
      null
    );
  }, [caseDetail?.case?.documents]);

  const handleDownloadResult = async () => {
    if (!caseId) return;
    setDownloadingResult(true);
    setDownloadError(null);
    try {
      const data = await getPublicResultDownload(caseId);
      if (data?.signedUrl) {
        window.location.href = data.signedUrl;
        return;
      }
      setDownloadError("Resultado indisponível no momento.");
    } catch (err) {
      if (err instanceof ApiError) {
        setDownloadError(err.message || "Não foi possível gerar o download.");
      } else {
        setDownloadError("Não foi possível gerar o download.");
      }
    } finally {
      setDownloadingResult(false);
    }
  };

  if (loading) {
    return <div className="px-6 py-10 text-sm text-gray-600">Carregando caso...</div>;
  }

  if (error) {
    return (
      <div className="px-6 py-10 space-y-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link className="text-sm text-blue-600 hover:underline" href="/ppp/novo">
          Criar novo caso
        </Link>
      </div>
    );
  }

  if (!caseDetail?.case) {
    return <div className="px-6 py-10 text-sm text-gray-600">Caso não encontrado.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Caso {caseDetail.case.id}</h1>
          <p className="text-xs text-gray-500">Criado em {formatDate(caseDetail.case.created_at)}</p>
        </div>
        <Link className="text-sm text-blue-600 hover:underline" href="/ppp/novo">
          Criar novo caso
        </Link>
      </div>

      {showErrorBanner && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-red-800">Erro no processamento</h3>
          <p className="text-xs text-red-700">
            {resolvePublicErrorMessage(lastErrorCode, lastErrorMessage)}
          </p>
          {lastErrorStep && (
            <p className="text-xs text-red-600">Etapa: {lastErrorStep}</p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Trabalhador</h3>
          <p className="text-sm text-gray-800">{caseDetail.case.worker?.name || "-"}</p>
          <p className="text-xs text-gray-500">CPF: {caseDetail.case.worker?.cpf || "-"}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Empresa</h3>
          <p className="text-sm text-gray-800">{caseDetail.case.company?.name || "-"}</p>
          <p className="text-xs text-gray-500">CNPJ: {caseDetail.case.company?.cnpj || "-"}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Status do caso</h3>
        <p className="text-sm text-gray-800">{statusLabel}</p>
        <p className="text-xs text-gray-500">Atualizado em {formatDate(caseDetail.case.updated_at)}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Pagamento</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Status:</span>
          <span className={`rounded-full px-2 py-1 ${paymentBadgeClass(paymentStatus)}`}>
            {formatPaymentStatus(paymentStatus)}
          </span>
        </div>
        {paymentUrl ? (
          <a
            href={paymentUrl}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Pagar agora
          </a>
        ) : (
          <Button
            onClick={handlePayment}
            disabled={creatingPayment}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {creatingPayment ? "Gerando..." : "Gerar link de pagamento"}
          </Button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Resultado</h3>
        {resultDoc ? (
          <>
            <p className="text-xs text-gray-500">
              Documento pronto para download.
              {resultDoc?.original_name ? ` Arquivo: ${resultDoc.original_name}` : ""}
            </p>
            <Button
              onClick={handleDownloadResult}
              disabled={downloadingResult}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {downloadingResult ? "Gerando..." : "Baixar resultado"}
            </Button>
          </>
        ) : (
          <p className="text-xs text-gray-500">Resultado ainda não disponível.</p>
        )}
        {downloadError && <p className="text-xs text-red-600">{downloadError}</p>}
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Reenviar PPP</h3>
        <p className="text-xs text-gray-500">
          Use esta opção em caso de erro de leitura ou atualização do documento.
        </p>
        <input
          type="file"
          accept="application/pdf"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              handleReupload(selected);
            }
          }}
          disabled={reuploading}
          className="text-sm"
        />
        {reuploadError && (
          <p className="text-xs text-red-600">{reuploadError}</p>
        )}
      </div>

      {searchParams?.get("payment") === "success" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
          Pagamento confirmado. O processamento foi iniciado.
        </div>
      )}
      {searchParams?.get("payment") === "failure" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          Pagamento não concluído. Tente novamente.
        </div>
      )}
    </div>
  );
}
