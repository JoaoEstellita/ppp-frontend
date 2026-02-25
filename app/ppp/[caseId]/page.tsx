"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  createPublicPayment,
  getPublicCase,
  getPublicInputDownload,
  getPublicResultDownload,
  reuploadPublicPpp,
  updatePublicCaseDetails,
} from "@/src/services/api";
import { Button } from "@/components/Button";
import { ResultSummaryCard } from "@/components/ResultSummaryCard";

const BASE_PRICE = 87.9;
const DISCOUNT_PRICE = 67.9;

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR");
}

function formatPrice(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return "";
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 9);
  const p4 = digits.slice(9, 11);
  return `${p1}.${p2}.${p3}-${p4}`.replace(/[-.]$/, "");
}

function formatCnpj(value: string) {
  const digits = digitsOnly(value).slice(0, 14);
  if (!digits) return "";
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 5);
  const p3 = digits.slice(5, 8);
  const p4 = digits.slice(8, 12);
  const p5 = digits.slice(12, 14);
  return `${p1}.${p2}.${p3}/${p4}-${p5}`.replace(/[-./]$/, "");
}

function formatStatus(status?: string | null) {
  switch (status) {
    case "awaiting_payment":
      return "Aguardando pagamento";
    case "awaiting_pdf":
      return "Aguardando documento";
    case "ready_to_process":
      return "Pronto para processar";
    case "processing":
    case "paid_processing":
      return "Em processamento";
    case "done":
      return "Concluído";
    case "done_warning":
      return "Concluído com alerta";
    case "error":
      return "Ação necessária";
    default:
      return status || "-";
  }
}

function getStatusTone(status?: string | null) {
  switch (status) {
    case "done":
      return "bg-emerald-100 text-emerald-700";
    case "done_warning":
      return "bg-amber-100 text-amber-700";
    case "error":
      return "bg-red-100 text-red-700";
    case "processing":
    case "paid_processing":
      return "bg-blue-100 text-blue-700";
    case "awaiting_payment":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function resolvePublicErrorMessage(code?: string | null, message?: string | null) {
  if (message) return message;
  switch ((code || "").toLowerCase()) {
    case "download_failed":
      return "Falha ao baixar o documento. Reenvie o PDF.";
    case "ocr_failed":
      return "Falha na leitura do documento. Reenvie o PDF.";
    case "ocr_size_limit":
      return "Arquivo muito grande para leitura automática. Reenvie um PDF menor.";
    case "validation_failed":
      return "Falha de validação técnica. Reenvie o PDF com dados corretos.";
    case "conflict_detected":
      return "Há divergências entre os dados do cadastro e o documento. Corrija os dados ou reenvie o PDF.";
    default:
      return "Erro no processamento. Tente reenviar o PDF.";
  }
}

function paymentStatusLabel(status?: string | null) {
  switch (status) {
    case "approved":
      return "Confirmado";
    case "in_process":
      return "Em processamento";
    case "rejected":
      return "Rejeitado";
    case "pending":
      return "Pendente";
    case "created":
      return "Criado";
    default:
      return status || "Pendente";
  }
}

function isPaymentSettled(
  caseStatus?: string | null,
  paymentStatus?: string | null,
  manualOverridePaid?: boolean
): boolean {
  if (paymentStatus === "approved") return true;
  if (manualOverridePaid) return true;
  return (
    caseStatus === "ready_to_process" ||
    caseStatus === "processing" ||
    caseStatus === "paid_processing" ||
    caseStatus === "done" ||
    caseStatus === "done_warning" ||
    caseStatus === "pending_info" ||
    caseStatus === "error"
  );
}

type TimelineStep = {
  id: string;
  title: string;
  done: boolean;
  active: boolean;
};

type EditableIdentity = {
  workerName: string;
  workerCPF: string;
  companyName: string;
  companyCNPJ: string;
};

export default function PublicCaseStatusPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const caseId = params?.caseId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<any | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [downloadingInput, setDownloadingInput] = useState(false);
  const [downloadInputError, setDownloadInputError] = useState<string | null>(null);
  const [downloadingResult, setDownloadingResult] = useState(false);
  const [downloadResultError, setDownloadResultError] = useState<string | null>(null);
  const [reuploading, setReuploading] = useState(false);
  const [reuploadError, setReuploadError] = useState<string | null>(null);
  const supportEmail = "contato@conectivos.net";

  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSuccess, setDetailsSuccess] = useState<string | null>(null);
  const [detailsForm, setDetailsForm] = useState<EditableIdentity>({
    workerName: "",
    workerCPF: "",
    companyName: "",
    companyCNPJ: "",
  });

  const fetchCase = useCallback(async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      setFetchError(null);
      const response = await getPublicCase(caseId);
      setCaseDetail(response);
      setPaymentUrl(response?.payment?.payment_url ?? null);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ppp:last_case_id", caseId);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const detailsMessage =
          typeof err.details === "object" && err.details !== null
            ? (err.details as any).message || (err.details as any).error
            : null;
        setFetchError(detailsMessage || err.message || "Erro ao buscar caso");
      } else {
        setFetchError("Erro ao buscar caso");
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
    const settled = isPaymentSettled(
      status,
      caseDetail?.payment?.status,
      Boolean(caseDetail?.case?.manual_override_paid)
    );
    const fastPolling = status === "processing" || status === "paid_processing";
    const slowPolling = status === "ready_to_process" && settled;
    if (!fastPolling && !slowPolling) return;
    const timer = setInterval(fetchCase, fastPolling ? 10000 : 30000);
    return () => clearInterval(timer);
  }, [caseDetail?.case?.status, caseDetail?.case?.manual_override_paid, caseDetail?.payment?.status, fetchCase]);

  useEffect(() => {
    if (!caseDetail?.case) return;
    setDetailsForm({
      workerName: caseDetail.case?.worker?.name || "",
      workerCPF: digitsOnly(caseDetail.case?.worker?.cpf || ""),
      companyName: caseDetail.case?.company?.name || "",
      companyCNPJ: digitsOnly(caseDetail.case?.company?.cnpj || ""),
    });
  }, [caseDetail?.case]);

  const status = caseDetail?.case?.status as string | undefined;
  const payment = caseDetail?.payment || null;
  const manualOverridePaid = Boolean(caseDetail?.case?.manual_override_paid);
  const paymentSettled = isPaymentSettled(status, payment?.status, manualOverridePaid);
  const lastErrorCode = caseDetail?.case?.last_error_code ?? null;
  const lastErrorMessage = caseDetail?.case?.last_error_message ?? null;
  const lastErrorStep = caseDetail?.case?.last_error_step ?? null;
  const unionCodeApplied = caseDetail?.case?.union_code_applied ?? null;
  const worker = caseDetail?.case?.worker ?? {};
  const company = caseDetail?.case?.company ?? {};

  const documents = useMemo(() => caseDetail?.case?.documents ?? [], [caseDetail?.case?.documents]);
  const inputDoc = useMemo(
    () =>
      documents.find(
        (doc: any) => doc.document_type === "ppp_input" || doc.type === "ppp_input"
      ) || null,
    [documents]
  );
  const resultDoc = useMemo(
    () =>
      documents.find(
        (doc: any) => doc.document_type === "ppp_result" || doc.type === "ppp_result"
      ) ||
      documents.find(
        (doc: any) => doc.document_type === "ppp_output" || doc.type === "ppp_output"
      ) ||
      null,
    [documents]
  );

  const timeline = useMemo<TimelineStep[]>(() => {
    const paymentDone = paymentSettled;
    const processing = status === "processing" || status === "paid_processing";
    const done = status === "done" || status === "done_warning";
    const errorStatus = status === "error";
    return [
      { id: "case", title: "Caso criado", done: true, active: !paymentDone },
      { id: "payment", title: "Pagamento", done: paymentDone, active: !paymentDone && status === "awaiting_payment" },
      { id: "processing", title: "Processamento", done: done, active: processing || errorStatus },
      { id: "result", title: "Resultado", done: done && Boolean(resultDoc), active: done && Boolean(resultDoc) },
    ];
  }, [paymentSettled, resultDoc, status]);

  async function handleGeneratePayment() {
    if (!caseId) return;
    setCreatingPayment(true);
    setActionError(null);
    try {
      const response = await createPublicPayment(caseId);
      if (response?.payment_url) {
        window.open(response.payment_url, "_blank", "noopener,noreferrer");
        setPaymentUrl(response.payment_url);
        setActionError("Link de pagamento aberto em nova aba.");
        return;
      }
      setActionError("Pagamento criado, mas o link não foi retornado.");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setActionError("Pagamento já iniciado para este caso.");
        } else {
          const detailsMessage =
            typeof err.details === "object" && err.details !== null
              ? (err.details as any).message || (err.details as any).error
              : null;
          setActionError(detailsMessage || err.message || "Erro ao gerar link de pagamento");
        }
      } else {
        setActionError("Erro ao gerar link de pagamento");
      }
    } finally {
      setCreatingPayment(false);
    }
  }

  async function handleSaveDetails() {
    if (!caseId) return;
    setDetailsError(null);
    setDetailsSuccess(null);

    const workerName = detailsForm.workerName.trim();
    const companyName = detailsForm.companyName.trim();
    const workerCPF = digitsOnly(detailsForm.workerCPF);
    const companyCNPJ = digitsOnly(detailsForm.companyCNPJ);

    if (!workerName || !companyName || workerCPF.length !== 11 || companyCNPJ.length !== 14) {
      setDetailsError("Preencha nome, CPF (11 dígitos), empresa e CNPJ (14 dígitos).");
      return;
    }

    setDetailsSaving(true);
    try {
      await updatePublicCaseDetails(caseId, {
        workerName,
        workerCPF,
        companyName,
        companyCNPJ,
      });
      setDetailsSuccess("Dados atualizados. O caso está pronto para novo envio.");
      setEditingDetails(false);
      await fetchCase();
    } catch (err) {
      if (err instanceof ApiError) {
        const detailsMessage =
          typeof err.details === "object" && err.details !== null
            ? (err.details as any).message || (err.details as any).error
            : null;
        setDetailsError(detailsMessage || err.message || "Erro ao atualizar os dados.");
      } else {
        setDetailsError("Erro ao atualizar os dados.");
      }
    } finally {
      setDetailsSaving(false);
    }
  }

  async function handleDownloadInput() {
    if (!caseId) return;
    setDownloadingInput(true);
    setDownloadInputError(null);
    try {
      const response = await getPublicInputDownload(caseId);
      if (response?.signedUrl) {
        window.open(response.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        setDownloadInputError("Documento de entrada indisponível no momento.");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setDownloadInputError(err.message || "Erro ao gerar download do documento enviado.");
      } else {
        setDownloadInputError("Erro ao gerar download do documento enviado.");
      }
    } finally {
      setDownloadingInput(false);
    }
  }

  async function handleDownloadResult() {
    if (!caseId) return;
    setDownloadingResult(true);
    setDownloadResultError(null);
    try {
      const response = await getPublicResultDownload(caseId);
      if (response?.signedUrl) {
        window.open(response.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        setDownloadResultError("Resultado indisponível no momento.");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setDownloadResultError(err.message || "Erro ao gerar download do resultado.");
      } else {
        setDownloadResultError("Erro ao gerar download do resultado.");
      }
    } finally {
      setDownloadingResult(false);
    }
  }

  async function handleReupload(file: File) {
    if (!caseId) return;
    setReuploading(true);
    setReuploadError(null);
    try {
      await reuploadPublicPpp(caseId, file);
      await fetchCase();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 413) {
          setReuploadError("Arquivo muito grande. Reenvie um PDF menor.");
        } else {
          setReuploadError(err.message || "Erro ao reenviar PDF.");
        }
      } else {
        setReuploadError("Erro ao reenviar PDF.");
      }
    } finally {
      setReuploading(false);
    }
  }

  if (loading) {
    return <div className="px-6 py-10 text-sm text-slate-600">Carregando caso...</div>;
  }

  if (fetchError) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>
        <div className="mt-4 flex gap-3">
          <Link href="/ppp/novo" className="text-sm font-medium text-blue-700 hover:underline">
            Criar novo caso
          </Link>
          <Link href="/ppp" className="text-sm font-medium text-slate-700 hover:underline">
            Voltar para início
          </Link>
          <button className="text-sm font-medium text-slate-700 hover:underline" onClick={fetchCase}>
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  if (!caseDetail?.case) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-slate-600">Caso não encontrado.</p>
      </main>
    );
  }

  const showErrorBanner =
    status === "error" ||
    Boolean(lastErrorCode) ||
    Boolean(lastErrorMessage) ||
    Boolean(caseDetail?.case?.has_divergence);

  const showIdentityEdit = showErrorBanner || status === "done_warning";
  const isDone = status === "done" || status === "done_warning";
  const isProcessing = status === "processing" || status === "paid_processing";
  const validationIssues = Array.isArray(caseDetail?.case?.validation_issues)
    ? caseDetail.case.validation_issues
    : [];
  const verifierIssues = Array.isArray(caseDetail?.case?.verifier_issues)
    ? caseDetail.case.verifier_issues
    : [];
  const analysisData = caseDetail?.analysis ?? caseDetail?.case?.analysis ?? null;
  const formalConformity =
    caseDetail?.case?.formal_conformity ??
    analysisData?.formalConformity ??
    analysisData?.extraMetadata?.formalConformity ??
    null;
  const technicalConformity =
    caseDetail?.case?.technical_conformity ??
    analysisData?.technicalConformity ??
    analysisData?.extraMetadata?.technicalConformity ??
    null;
  const probativeValue =
    caseDetail?.case?.probative_value ??
    analysisData?.probativeValue ??
    analysisData?.extraMetadata?.probativeValue ??
    null;
  const confidenceLevel =
    caseDetail?.case?.confidence_level ??
    analysisData?.confidenceLevel ??
    analysisData?.extraMetadata?.confidenceLevel ??
    null;
  const findingsWithEvidence = Array.isArray(
    caseDetail?.case?.findings_with_evidence ?? analysisData?.findingsWithEvidence
  )
    ? (caseDetail?.case?.findings_with_evidence ?? analysisData?.findingsWithEvidence)
    : [];
  const suggestedActions = Array.isArray(caseDetail?.case?.next_actions ?? analysisData?.nextActions)
    ? (caseDetail?.case?.next_actions ?? analysisData?.nextActions)
    : [];
  const nextActions = (() => {
    if (suggestedActions.length > 0) {
      return suggestedActions.slice(0, 3);
    }
    if (showErrorBanner) {
      return [
        "Revise os dados de cadastro e compare com o documento.",
        "Reenvie o PDF com melhor qualidade ou dados corrigidos.",
        "Acompanhe o status ate o callback final.",
      ];
    }
    if (resultDoc) {
      return [
        "Baixe e guarde o resultado final.",
        "Se precisar, compartilhe o PDF com seu sindicato ou advogado.",
      ];
    }
    if (status === "processing" || status === "paid_processing") {
      return ["Aguarde a conclusao do processamento."];
    }
    if (status === "ready_to_process") {
      return ["Aguarde o envio para analise pelo sindicato/admin."];
    }
    return ["Acompanhe as proximas atualizacoes do caso por este link."];
  })();

  function handleSupportContact() {
    const subject = encodeURIComponent(`Suporte PPP - Caso ${caseDetail?.case?.id || caseId || ""}`);
    const body = encodeURIComponent(
      [
        `Caso: ${caseDetail?.case?.id || caseId || "-"}`,
        `Status: ${status || "-"}`,
        `Erro: ${resolvePublicErrorMessage(lastErrorCode, lastErrorMessage) || "-"}`,
        "",
        "Descreva abaixo o que aconteceu:",
      ].join("\n")
    );
    window.open(`mailto:${supportEmail}?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Caso {caseDetail.case.id}</h1>
            <p className="mt-1 text-sm text-slate-600">Criado em {formatDate(caseDetail.case.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusTone(status)}`}>
              {formatStatus(status)}
            </span>
            <Link href="/ppp/novo">
              <Button variant="outline">Novo caso</Button>
            </Link>
          </div>
        </div>

        {showErrorBanner && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Último problema</p>
            <p className="mt-1">{resolvePublicErrorMessage(lastErrorCode, lastErrorMessage)}</p>
            {lastErrorStep && <p className="mt-1 text-xs">Etapa: {lastErrorStep}</p>}
          </div>
        )}

        {actionError && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            {actionError}
          </div>
        )}

        {detailsSuccess && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {detailsSuccess}
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Andamento</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {timeline.map((step) => (
              <div
                key={step.id}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  step.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : step.active
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {step.title}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <ResultSummaryCard
            audience="worker"
            status={status}
            finalClassification={
              caseDetail?.case?.final_classification ??
              caseDetail?.case?.finalClassification ??
              caseDetail?.case?.analysis?.final_classification ??
              null
            }
            summary={caseDetail?.case?.analysis_summary ?? caseDetail?.case?.analysis?.summary ?? null}
            validationOk={caseDetail?.case?.validation_ok ?? null}
            validationIssues={validationIssues}
            verifierRisk={caseDetail?.case?.verifier_risk ?? null}
            verifierIssues={verifierIssues}
            resultAvailable={Boolean(resultDoc)}
            lastErrorMessage={showErrorBanner ? resolvePublicErrorMessage(lastErrorCode, lastErrorMessage) : null}
            nextActions={nextActions}
            updatedAt={caseDetail?.case?.updated_at ?? null}
            formalConformity={formalConformity}
            technicalConformity={technicalConformity}
            probativeValue={probativeValue}
            confidenceLevel={confidenceLevel}
            findingsWithEvidence={findingsWithEvidence}
          />
        </div>

        {(Boolean(resultDoc) || showErrorBanner) && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {Boolean(resultDoc) && (
                <Button
                  onClick={handleDownloadResult}
                  disabled={downloadingResult}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {downloadingResult ? "Gerando..." : "Baixar resultado"}
                </Button>
              )}
              {showErrorBanner && (
                <>
                  <a
                    href="#reenviar-pdf"
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Reenviar PDF agora
                  </a>
                  <Button variant="outline" onClick={handleSupportContact}>
                    Pedir suporte
                  </Button>
                </>
              )}
            </div>
            {downloadResultError && <p className="mt-2 text-xs text-red-600">{downloadResultError}</p>}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Dados informados</h3>
                {showIdentityEdit && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingDetails((prev) => !prev);
                      setDetailsError(null);
                      setDetailsSuccess(null);
                    }}
                  >
                    {editingDetails ? "Cancelar" : "Corrigir dados"}
                  </Button>
                )}
              </div>

              {!editingDetails && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Trabalhador</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{worker?.name || "-"}</p>
                    <p className="mt-1 text-xs text-slate-600">CPF: {worker?.cpf || "-"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Empresa</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{company?.name || "-"}</p>
                    <p className="mt-1 text-xs text-slate-600">CNPJ: {company?.cnpj || "-"}</p>
                  </div>
                </div>
              )}

              {editingDetails && (
                <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-600">
                    Corrija os dados como aparecem no PPP. Depois disso, reenvie para análise.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-slate-600">
                      Nome do trabalhador
                      <input
                        value={detailsForm.workerName}
                        onChange={(event) =>
                          setDetailsForm((prev) => ({ ...prev, workerName: event.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      CPF
                      <input
                        value={formatCpf(detailsForm.workerCPF)}
                        onChange={(event) =>
                          setDetailsForm((prev) => ({ ...prev, workerCPF: digitsOnly(event.target.value) }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Empresa
                      <input
                        value={detailsForm.companyName}
                        onChange={(event) =>
                          setDetailsForm((prev) => ({ ...prev, companyName: event.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      CNPJ
                      <input
                        value={formatCnpj(detailsForm.companyCNPJ)}
                        onChange={(event) =>
                          setDetailsForm((prev) => ({ ...prev, companyCNPJ: digitsOnly(event.target.value) }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  {detailsError && <p className="text-xs text-red-600">{detailsError}</p>}
                  <div className="flex gap-2">
                    <Button onClick={handleSaveDetails} disabled={detailsSaving}>
                      {detailsSaving ? "Salvando..." : "Salvar correções"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingDetails(false);
                        setDetailsError(null);
                      }}
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              )}

              <p className="mt-3 text-xs text-slate-500">Atualizado em {formatDate(caseDetail.case.updated_at)}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Documento enviado</h3>
              {inputDoc ? (
                <>
                  <p className="mt-2 text-sm text-slate-700">{inputDoc.fileName || "Arquivo do PPP enviado"}</p>
                  <p className="mt-1 text-xs text-slate-500">Enviado em {formatDate(inputDoc.created_at)}</p>
                  <Button
                    onClick={handleDownloadInput}
                    disabled={downloadingInput}
                    className="mt-3 bg-slate-800 text-white hover:bg-slate-900"
                  >
                    {downloadingInput ? "Gerando..." : "Baixar documento enviado"}
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Documento ainda não localizado.</p>
              )}
              {downloadInputError && <p className="mt-2 text-xs text-red-600">{downloadInputError}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Resultado</h3>
              {resultDoc ? (
                <>
                  <p className="mt-2 text-sm text-slate-700">
                    {resultDoc.fileName || "Resultado disponível para download"}
                  </p>
                  <Button
                    onClick={handleDownloadResult}
                    disabled={downloadingResult}
                    className="mt-3 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {downloadingResult ? "Gerando..." : "Baixar resultado"}
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Resultado ainda não disponível.</p>
              )}
              {downloadResultError && <p className="mt-2 text-xs text-red-600">{downloadResultError}</p>}
            </div>

            <div id="reenviar-pdf" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Reenviar PDF</h3>
              <p className="mt-1 text-sm text-slate-600">
                Use esta ação quando houver falha de leitura ou solicitação de atualização.
              </p>
              <input
                type="file"
                accept="application/pdf"
                disabled={reuploading}
                className="mt-3 text-sm"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) {
                    handleReupload(selected);
                  }
                }}
              />
              {reuploadError && <p className="mt-2 text-xs text-red-600">{reuploadError}</p>}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Pagamento</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="font-medium text-slate-900">
                    {paymentSettled
                      ? "Confirmado"
                      : paymentStatusLabel(payment?.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Valor</span>
                  <span className="font-medium text-slate-900">{formatPrice(payment?.amount || BASE_PRICE)}</span>
                </div>
                {unionCodeApplied && (
                  <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                    <p>Código aplicado: {unionCodeApplied}</p>
                    <p>Preço padrão: {formatPrice(BASE_PRICE)}</p>
                    <p>Preço com desconto: {formatPrice(DISCOUNT_PRICE)}</p>
                  </div>
                )}
              </div>

              {paymentSettled ? (
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {isDone
                    ? "Pagamento confirmado."
                    : isProcessing
                    ? "Pagamento confirmado. Processamento em andamento."
                    : "Pagamento confirmado. Aguardando inicio do processamento. Esta pagina atualiza automaticamente a cada 30 segundos."}
                </div>
              ) : paymentUrl ? (
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  Pagar agora
                </a>
              ) : (
                <Button
                  onClick={handleGeneratePayment}
                  disabled={creatingPayment}
                  className="mt-4 w-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {creatingPayment ? "Gerando..." : "Gerar link de pagamento"}
                </Button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Recuperação</h3>
              <p className="mt-2 text-sm text-slate-600">
                Se sua internet cair, você pode voltar usando este mesmo link do caso.
              </p>
              <p className="mt-2 break-all text-xs text-slate-500">{caseDetail.case.id}</p>
            </div>

            {showErrorBanner && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-red-800">Precisa de ajuda?</h3>
                <p className="mt-2 text-sm text-red-700">
                  Se o erro persistir, reenvie o PDF e acione o suporte com o codigo do caso.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="#reenviar-pdf"
                    className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-medium text-red-700 border border-red-200 hover:bg-red-100"
                  >
                    Reenviar PDF
                  </a>
                  <Button variant="outline" onClick={handleSupportContact}>
                    Pedir suporte
                  </Button>
                </div>
              </div>
            )}

            {!paymentSettled && searchParams?.get("payment") === "success" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                Pagamento confirmado. O processamento foi iniciado.
              </div>
            )}
            {!paymentSettled && searchParams?.get("payment") === "failure" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                Pagamento não concluído. Gere um novo link e tente novamente.
              </div>
            )}
            {!paymentSettled && searchParams?.get("payment") === "pending" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                Pagamento pendente. Aguarde a confirmação ou tente novamente mais tarde.
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

