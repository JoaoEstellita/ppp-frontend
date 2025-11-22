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
  API_BASE_URL,
} from "@/src/services/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { CasePppUploadAndAnalysis } from "@/components/CasePppUploadAndAnalysis";

interface PageProps {
  params: { id: string };
}

const CASE_STATUS_LABELS: Record<string, string> = {
  pending_documents: "Aguardando envio do PPP",
  processing: "Documento recebido - em análise em andamento",
  analyzed: "Análise concluída",
  error: "Erro na análise",
};

function getStatusBadgeVariant(value: CaseStatus | string):
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "default" {
  switch (value) {
    case "analyzed":
      return "success";
    case "processing":
      return "info";
    case "pending_documents":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

function formatCaseStatus(value: string | undefined | null) {
  if (!value) return "Aguardando envio do PPP";
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
  SENT_TO_N8N: "Enviado para análise técnica",
  N8N_ANALYSIS_RECEIVED: "Análise técnica concluída",
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
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    analysis: analysisFromApi,
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
  const analysis = analysisFromApi ?? null;
  const hasAnalysis = !!analysis && !!analysis.finalClassification;
  const hasReport = !!analysis?.parecerHtml;
  const rulesResult = resolveAnalysisResults(analysis);
  const resolvedResults = analysis?.results ?? rulesResult ?? analysis?.raw_ai_result?.results ?? null;
  const finalClassification =
    analysis?.final_classification ??
    analysis?.finalClassification ??
    resolvedResults?.finalClassification ??
    rulesResult?.finalClassification;
  const analysisDate =
    analysis?.created_at ??
    (analysis as any)?.generated_at ??
    (analysis as any)?.generatedAt ??
    null;
  const extraMetadata = analysis?.extra_metadata ?? (analysis as any)?.extraMetadata ?? null;
  const parecerHtml = analysis?.parecerHtml ?? extraMetadata?.parecerHtml ?? null;
  const emailsSentTo =
    analysis?.emailsSentTo ??
    (analysis as any)?.emails_sent_to ??
    caseDetail.emailsSentTo ??
    [];
  const workflowLogs = workflowLogsFromApi ?? [];
  const rawStatus = (caseRecord.statusRaw || caseRecord.status) as CaseStatus;
  const caseStatus: CaseStatus = hasAnalysis ? "analyzed" : rawStatus;
  const statusLabel = formatCaseStatus(caseStatus);
  const summary =
    analysis?.results?.summary ??
    analysis?.raw_ai_result?.results?.summary ??
    resolvedResults?.summary ??
    null;
  const isPending = caseStatus === "pending_documents";
  const isProcessing = caseStatus === "processing";
  const isError = caseStatus === "error";
  const docxUrl = `${API_BASE_URL}/cases/${caseRecord.id}/parecer.docx`;
  const pdfUrl = `${API_BASE_URL}/cases/${caseRecord.id}/parecer.pdf`;

  const handleCopyParecer = () => {
    if (!parecerHtml) return;
    navigator.clipboard?.writeText(parecerHtml);
  };
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchCase();
    } catch (err) {
      console.error("Manual refresh error", err);
    } finally {
      setIsRefreshing(false);
    }
  };

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
            Faça o upload do PPP em PDF e o parecer será enviado por e-mail aos
            responsáveis cadastrados.
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
                <Badge variant={getStatusBadgeVariant(caseStatus)}>
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
          <div className="mt-4">
            <Button variant="outline" onClick={handleRefresh}>
              Atualizar situacao do caso
            </Button>
          </div>
        </Card>

        <Card title="Analise do PPP">
          {caseStatus === "pending_documents" ? (
            <div className="text-sm text-gray-600">
              Ainda não foi enviado nenhum PPP. Envie o documento acima para iniciar a análise técnica.
            </div>
          ) : caseStatus === "processing" && !hasAnalysis ? (
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-ping rounded-full bg-blue-500" />
              PPP em análise técnica. Isso pode levar alguns minutos. Você pode continuar usando o sistema normalmente e clicar em &quot;Atualizar situação do caso&quot; mais tarde para verificar o laudo.
            </div>
          ) : caseStatus === "error" ? (
            <div className="text-sm text-red-600">
              Não foi possível concluir a análise do PPP. Tente reenviar o documento ou contate o suporte.
            </div>
          ) : caseStatus === "analyzed" && hasAnalysis && hasReport ? (
            <div className="space-y-4 text-sm">
              {summary && (
                <p>
                  <strong>Resumo tecnico:</strong> {summary}
                </p>
              )}
              {finalClassification && (
                <p>
                  <strong>Classificacao final:</strong> {finalClassification}
                </p>
              )}
              <p className="text-gray-600">
                O laudo técnico completo será disponibilizado em PDF e enviado por e-mail aos responsáveis cadastrados. Abaixo você pode visualizar o texto técnico gerado pela análise.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={docxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Baixar laudo (DOCX)
                </a>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Baixar laudo (PDF)
                </a>
                {parecerHtml && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyParecer}
                    disabled={!parecerHtml}
                  >
                    Copiar parecer (HTML)
                  </Button>
                )}
              </div>
              {parecerHtml && (
                <div className="prose prose-sm max-w-none border rounded-md p-4 bg-white">
                  <div dangerouslySetInnerHTML={{ __html: parecerHtml }} />
                </div>
              )}
            </div>
          ) : caseStatus === "analyzed" && !hasReport ? (
            <div className="text-sm text-gray-600">
              A análise foi concluída, mas o laudo ainda está sendo finalizado. Clique em &quot;Atualizar situação do caso&quot; em alguns instantes.
            </div>
          ) : null}
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




