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
      "blocks" in value &&
      Array.isArray((value as AnalysisResult).blocks)
  );
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

  const { case: caseRecord, analysis, workflowLogs: workflowLogsFromApi } = caseDetail;
  const rulesResult = hasBlocks(analysis?.rules_result)
    ? analysis?.rules_result
    : hasBlocks(analysis)
      ? (analysis as AnalysisResult)
      : null;
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
                {caseRecord.worker?.name || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CPF</p>
              <p className="text-base font-medium text-gray-900">
                {caseRecord.worker?.cpf || "-"}
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
                {caseRecord.company?.name || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CNPJ</p>
              <p className="text-base font-medium text-gray-900">
                {caseRecord.company?.cnpj || "-"}
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Badge variant={getFinalClassificationVariant(analysis.final_classification)}>
                    {formatFinalClassificationLabel(analysis.final_classification)}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    Concluida em {formatDateTime(analysis.created_at)}
                  </span>
                </div>
                {analysis.emailsSentTo && analysis.emailsSentTo.length > 0 && (
                  <p className="text-sm text-gray-600">
                    Parecer enviado para: {analysis.emailsSentTo.join(", ")}
                  </p>
                )}
                {rulesResult?.summary && (
                  <p className="text-sm text-gray-700">{rulesResult.summary}</p>
                )}
              </div>

              {rulesResult && rulesResult.blocks && rulesResult.blocks.length > 0 ? (
                <div className="space-y-4">
                  {rulesResult.blocks.map((block) => (
                    <div key={block.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-base font-semibold text-gray-900">{block.title}</h4>
                        <Badge variant={getBlockStatusVariant(block.status)}>
                          {formatBlockStatus(block.status)}
                        </Badge>
                      </div>
                      {block.findings && block.findings.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                          {block.findings.map((finding) => (
                            <li key={finding.code}>{finding.message}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">Nenhum problema identificado.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  A analise foi concluida, e o parecer foi enviado por e-mail. Nenhum detalhe adicional foi retornado.
                </p>
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
