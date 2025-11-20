"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCaseDetail,
  CaseDetail,
  CaseStatus,
  FinalClassification,
  BlockStatus,
  AnalysisResult,
  WorkflowLog,
  CaseAnalysis,
} from "@/src/services/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { CasePppUploadAndAnalysis } from "@/components/CasePppUploadAndAnalysis";

interface PageProps {
  params: { id: string };
}

const CASE_STATUS_LABELS: Record<string, string> = {
  EM_ANALISE: "Em analise",
  COMPLETO: "Completo",
  INCOMPLETO: "Incompleto",
  ERRO: "Erro",
  new: "Aguardando envio do PPP",
  received: "Aguardando envio do PPP",
  processing: "Documento recebido - em analise automatica",
  analyzed: "Analise concluida",
  error: "Erro na analise",
};

function getStatusBadgeVariant(value: CaseStatus | string):
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "default" {
  switch (value) {
    case "COMPLETO":
    case "analyzed":
      return "success";
    case "EM_ANALISE":
    case "processing":
      return "info";
    case "INCOMPLETO":
    case "new":
    case "received":
      return "warning";
    case "ERRO":
    case "error":
      return "danger";
    default:
      return "default";
  }
}

function formatCaseStatus(value: string | undefined | null) {
  if (!value) return "Incompleto";
  return CASE_STATUS_LABELS[value] ?? value;
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFinalClassificationLabel(value: FinalClassification | string | undefined) {
  switch (value) {
    case "ATENDE_INTEGRALMENTE":
      return "Atende integralmente";
    case "POSSUI_INCONSISTENCIAS_SANAVEIS":
      return "Com inconsistencias sanaveis";
    case "NAO_POSSUI_VALIDADE_TECNICA":
      return "Nao possui validade tecnica";
    default:
      return value || "Nao avaliado";
  }
}

function getFinalClassificationVariant(value: FinalClassification | string | undefined) {
  switch (value) {
    case "ATENDE_INTEGRALMENTE":
      return "success";
    case "POSSUI_INCONSISTENCIAS_SANAVEIS":
      return "warning";
    case "NAO_POSSUI_VALIDADE_TECNICA":
      return "danger";
    default:
      return "info";
  }
}

function formatBlockStatus(value: BlockStatus | undefined) {
  switch (value) {
    case "APPROVED":
      return "Aprovado";
    case "PENDING":
      return "Com pendencias";
    case "REPROVED":
      return "Reprovado";
    default:
      return "Nao avaliado";
  }
}

function getBlockStatusVariant(value: BlockStatus | undefined):
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "default" {
  switch (value) {
    case "APPROVED":
      return "success";
    case "PENDING":
      return "warning";
    case "REPROVED":
      return "danger";
    case "NOT_EVALUATED":
    default:
      return "info";
  }
}

function formatDateOnly(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

const WORKFLOW_STEP_LABELS: Record<string, string> = {
  PPP_UPLOADED: "PPP recebido",
  SENT_TO_N8N: "Enviado para analise automatica",
  N8N_ANALYSIS_RECEIVED: "Analise automatica concluida",
  ANALYSIS_SAVED: "Resultado salvo",
  EMAIL_SENT: "Parecer enviado por e-mail",
  N8N_ERROR: "Erro ao integrar com n8n",
  ANALYSIS_PERSIST_FAILED: "Erro ao salvar analise",
  ANALYSIS_FAILED: "Erro inesperado",
};

function formatWorkflowStep(step: string) {
  if (!step) return "Atualizacao";
  return WORKFLOW_STEP_LABELS[step] ?? step.replace(/_/g, " ").toLowerCase();
}

function hasBlocks(value: unknown): value is AnalysisResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("blocks" in value || "summary" in value || "flags" in value)
  );
}

function resolveAnalysisResults(analysis: CaseAnalysis | null | undefined): AnalysisResult | null {
  if (!analysis) return null;
  if (hasBlocks(analysis.rules_result)) {
    return analysis.rules_result;
  }
  const candidate: any = analysis;
  if (hasBlocks(candidate.results)) {
    return candidate.results;
  }
  if (hasBlocks(candidate.raw_ai_result?.results)) {
    return candidate.raw_ai_result.results;
  }
  return null;
}

export default function CaseDetailPage({ params }: PageProps) {
  const { id } = params;
  const router = useRouter();
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCaseDetail(id);
      setCaseDetail(data);
    } catch (err) {
      console.error(err);
      setError("Nao foi possivel carregar os detalhes do caso.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-600">
        Carregando detalhes do caso...
      </div>
    );
  }

  if (error || !caseDetail) {
    return (
      <div>
        <p className="text-red-600">{error || "Caso nao encontrado."}</p>
        <Button onClick={() => router.push("/cases")} className="mt-4">
          Voltar para lista
        </Button>
      </div>
    );
  }

  const {
    case: caseRecord,
    analysis,
    workflowLogs: workflowLogsFromApi,
    worker,
    company,
  } = caseDetail;
  const resolvedWorker = worker ?? caseRecord.worker ?? null;
  const resolvedCompany = company ?? caseRecord.company ?? null;
  const workerName = resolvedWorker?.name ?? "-";
  const workerCpf = resolvedWorker?.cpf ?? "-";
  const companyName = resolvedCompany?.name ?? "-";
  const companyCnpj = resolvedCompany?.cnpj ?? "-";
  const rulesResult = resolveAnalysisResults(analysis);
  const finalClassification =
    analysis?.final_classification ??
    (analysis as any)?.finalClassification ??
    rulesResult?.finalClassification;
  const analysisDate =
    analysis?.created_at ??
    (analysis as any)?.generated_at ??
    (analysis as any)?.generatedAt ??
    null;
  const summaryText = rulesResult?.summary ?? "";
  const analysisFlags = rulesResult?.flags ?? [];
  const analysisBlocks = rulesResult?.blocks ?? [];
  const extraMetadata = analysis?.extra_metadata ?? (analysis as any)?.extraMetadata ?? null;
  const observations = extraMetadata?.observations;
  const emailsSentTo =
    analysis?.emailsSentTo ??
    (analysis as any)?.emails_sent_to ??
    caseDetail.emailsSentTo ??
    [];
  const workflowLogs = workflowLogsFromApi ?? [];
  const statusValue = caseRecord.statusRaw || caseRecord.status;
  const statusLabel = formatCaseStatus(statusValue);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Caso #{caseRecord.id}</h2>
        <Button onClick={() => router.push("/cases")} variant="outline">
          Voltar
        </Button>
      </div>

      <div className="space-y-6">
        <Card title="Enviar PPP para analise">
          <p className="text-sm text-gray-600 mb-4">
            Faca o upload do PPP em PDF e o parecer sera enviado automaticamente por e-mail
            aos responsaveis cadastrados.
          </p>
          <CasePppUploadAndAnalysis caseId={caseRecord.id} onCompleted={fetchCase} />
        </Card>

        <Card title="Dados do Trabalhador">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="text-base font-medium text-gray-900">
                {workerName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CPF</p>
              <p className="text-base font-medium text-gray-900">
                {workerCpf}
              </p>
            </div>
            {caseRecord.worker?.birthDate && (
              <div>
                <p className="text-sm text-gray-600">Data de nascimento</p>
                <p className="text-base font-medium text-gray-900">
                  {formatDateOnly(caseRecord.worker?.birthDate)}
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card title="Dados da Empresa">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="text-base font-medium text-gray-900">
                {companyName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CNPJ</p>
              <p className="text-base font-medium text-gray-900">
                {companyCnpj}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Informacoes do Caso">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Protocolo</p>
              <p className="text-base font-medium text-gray-900">
                #{caseRecord.id}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(statusValue || caseRecord.status)}>
                  {statusLabel}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data de criacao</p>
              <p className="text-base font-medium text-gray-900">
                {formatDateTime(caseRecord.createdAt)}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Analise do PPP">
          {!analysis ? (
            <div className="text-sm text-gray-600">
              Ainda nao analisado. Assim que o PPP for enviado, o parecer sera emitido e enviado por e-mail.
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">Resultado da analise</p>
                    {analysisDate && (
                      <p className="text-xs text-gray-500">
                        Gerado em {formatDateTime(analysisDate)}
                      </p>
                    )}
                  </div>
                  {finalClassification && (
                    <Badge variant={getFinalClassificationVariant(finalClassification)}>
                      {formatFinalClassificationLabel(finalClassification)}
                    </Badge>
                  )}
                </div>
                {emailsSentTo && emailsSentTo.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    Parecer enviado para: {emailsSentTo.join(", ")}
                  </p>
                )}
                {summaryText && (
                  <p className="mt-3 text-sm text-gray-800">
                    <strong>Resumo:&nbsp;</strong>
                    {summaryText}
                  </p>
                )}
              </div>

              {analysisFlags.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-900">Pontos de atencao</p>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {analysisFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisBlocks.length > 0 ? (
                <div className="space-y-4">
                  {analysisBlocks.map((block, index) => {
                    const blockId = block.blockId ?? block.id ?? String(index);
                    const title = block.title || (blockId ? `Bloco ${blockId}` : "Bloco");
                    const isCompliant =
                      typeof block.isCompliant === "boolean"
                        ? block.isCompliant
                        : block.status === "APPROVED";
                    const issues =
                      block.issues ??
                      (block.findings
                        ? block.findings
                            .map((finding) => finding.message)
                            .filter(Boolean)
                        : []);
                    return (
                      <div key={`${blockId}-${title}`} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {blockId ? `${blockId} - ${title}` : title}
                          </h4>
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 ${
                              isCompliant
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {isCompliant ? "Conforme" : "Nao conforme"}
                          </span>
                        </div>
                        {block.analysis && <p className="text-sm text-gray-700 mb-2">{block.analysis}</p>}
                        {issues.length > 0 && !isCompliant && (
                          <ul className="list-disc list-inside space-y-1 text-xs text-gray-600">
                            {issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Nenhum bloco detalhado foi retornado para esta analise.
                </p>
              )}

              {observations && (
                <div className="text-sm text-gray-700">
                  <p className="font-semibold mb-1">Observacoes adicionais</p>
                  <p>{observations}</p>
                </div>
              )}
            </div>
          )}
        </Card>
        {workflowLogs.length > 0 && (
          <Card title="Historico do caso">
            <ol className="space-y-3">
              {workflowLogs.map((log) => (
                <li key={log.id} className="flex flex-col md:flex-row md:items-start md:gap-4">
                  <span className="text-xs text-gray-500 w-40">
                    {formatDateTime(log.created_at)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatWorkflowStep(log.step)}
                    </p>
                    {log.message && (
                      <p className="text-sm text-gray-600">{log.message}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </div>
  );
}
