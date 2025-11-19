"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  getCaseById,
  getPPPUrl,
  getReportUrl,
  uploadPPP,
  generateCaseAnalysis,
  downloadPPP,
  downloadReport,
  FrontendCase,
  AnalysisResult,
  BlockStatus,
  FinalClassification,
  ApiError,
} from "@/src/services/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

interface PageProps {
  params: { id: string };
}

const CASE_STATUS_LABELS: Record<string, string> = {
  EM_ANALISE: "Em analise",
  COMPLETO: "Completo",
  INCOMPLETO: "Incompleto",
  ERRO: "Erro",
  received: "Recebido",
  processing: "Em andamento",
  analyzed: "Completo",
  error: "Erro",
};

const CASE_STATUS_VARIANTS: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  EM_ANALISE: "info",
  COMPLETO: "success",
  INCOMPLETO: "danger",
  ERRO: "danger",
  received: "warning",
  processing: "info",
  analyzed: "success",
  error: "danger",
};

function normalizeStatusKey(value: string | undefined | null): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (CASE_STATUS_LABELS[upper]) return upper;
  const lower = value.toLowerCase();
  if (CASE_STATUS_LABELS[lower]) return lower;
  return value;
}

function formatCaseStatus(value: string | undefined | null): string {
  const key = normalizeStatusKey(value);
  if (!key) return "Incompleto";
  return CASE_STATUS_LABELS[key] ?? key;
}

function getStatusBadgeVariant(value: string | undefined | null): "success" | "warning" | "danger" | "info" | "default" {
  const key = normalizeStatusKey(value);
  if (!key) return "danger";
  return CASE_STATUS_VARIANTS[key] ?? "default";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFinalClassification(value: FinalClassification | undefined): string {
  switch (value) {
    case "ATENDE_INTEGRALMENTE":
      return "Atende integralmente";
    case "POSSUI_INCONSISTENCIAS_SANAVEIS":
      return "Com inconsistencias sanaveis";
    case "NAO_POSSUI_VALIDADE_TECNICA":
      return "Nao possui validade tecnica";
    default:
      return "Nao avaliado";
  }
}

function getFinalClassificationVariant(value: FinalClassification | undefined): "success" | "warning" | "danger" | "info" | "default" {
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

function formatBlockStatus(value: BlockStatus | undefined): string {
  switch (value) {
    case "APPROVED":
      return "Aprovado";
    case "PENDING":
      return "Com pendencias";
    case "REPROVED":
      return "Reprovado";
    case "NOT_EVALUATED":
    default:
      return "Nao avaliado";
  }
}

function getBlockStatusVariant(value: BlockStatus | undefined): "success" | "warning" | "danger" | "info" | "default" {
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

export default function CaseDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = params;
  const [caseData, setCaseData] = useState<FrontendCase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [isDownloadingPPP, setIsDownloadingPPP] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCase() {
      try {
        setLoading(true);
        setError(null);
        const caseResult = await getCaseById(id);
        if (!active) return;
        setCaseData(caseResult);
        setAnalysis(caseResult.analysis ?? null);
      } catch (err) {
        if (!active) return;
        console.error("Erro ao carregar caso:", err);
        if (err instanceof ApiError) {
          setError(err.message || "Nao foi possivel carregar o caso.");
        } else {
          setError("Nao foi possivel carregar o caso.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCase();

    return () => {
      active = false;
    };
  }, [id]);

  const reloadCase = async () => {
    if (!caseData) return null;
    try {
      const updated = await getCaseById(caseData.id);
      setCaseData(updated);
      setAnalysis(updated.analysis ?? null);
      return updated;
    } catch (err) {
      console.error("Erro ao atualizar caso:", err);
      return null;
    }
  };

  const handleGenerateReport = () => {
    if (!caseData) return;
    setGeneratingReport(true);
    const url = getReportUrl(caseData.id);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => setGeneratingReport(false), 800);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleUploadPPP = async () => {
    if (!caseData) return;
    if (!selectedFile) {
      alert("Selecione um arquivo PDF antes de enviar.");
      return;
    }

    try {
      setIsUploading(true);
      await uploadPPP(caseData.id, selectedFile);
      await reloadCase();
      alert("PPP enviado com sucesso.");
    } catch (err) {
      console.error("Falha no upload do PPP:", err);
      if (err instanceof ApiError) {
        alert(err.message || "Falha ao enviar o PPP.");
      } else {
        alert("Falha ao enviar o PPP.");
      }
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!caseData) return;

    try {
      setIsGeneratingAnalysis(true);
      const result = await generateCaseAnalysis(caseData.id);
      setAnalysis(result);
      await reloadCase();
      alert("Analise gerada com sucesso.");
    } catch (err) {
      console.error("Erro ao gerar analise:", err);
      if (err instanceof ApiError) {
        if (err.code === "PPP_NAO_ENCONTRADO") {
          alert("Envie o PPP antes de gerar a analise.");
        } else {
          alert(err.message || "Falha ao gerar a analise.");
        }
      } else {
        alert("Falha ao gerar a analise.");
      }
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  const handleDownloadPPP = async () => {
    if (!caseData) return;
    try {
      setIsDownloadingPPP(true);
      const blob = await downloadPPP(caseData.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ppp_${caseData.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao baixar PPP:", err);
      if (err instanceof ApiError) {
        alert(err.message || "Falha ao baixar o PPP.");
      } else {
        alert("Falha ao baixar o PPP.");
      }
    } finally {
      setIsDownloadingPPP(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!caseData) return;
    try {
      setIsDownloadingReport(true);
      const blob = await downloadReport(caseData.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `parecer_${caseData.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao baixar parecer:", err);
      if (err instanceof ApiError) {
        alert(err.message || "Falha ao baixar o parecer.");
      } else {
        alert("Falha ao baixar o parecer.");
      }
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const pppDoc = caseData?.documents?.find((doc) => (doc.type || "").toLowerCase() === "ppp");
  const pppFileName =
    pppDoc?.fileName ||
    (pppDoc as any)?.file ||
    (pppDoc as any)?.name ||
    (caseData as any)?.pppFileName ||
    null;

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-600">Carregando detalhes do caso...</div>
    );
  }

  if (error || !caseData) {
    return (
      <div>
        <p className="text-red-600">{error || "Caso nao encontrado."}</p>
        <Button onClick={() => router.push("/cases")} className="mt-4">
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Caso #{caseData.id}</h2>
        <Button onClick={() => router.push("/cases")} variant="outline">
          Voltar
        </Button>
      </div>

      <div className="space-y-6">
        <Card title="Dados do Trabalhador">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="text-base font-medium text-gray-900">
                {caseData.worker?.name || (caseData as any).workerName || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CPF</p>
              <p className="text-base font-medium text-gray-900">
                {caseData.worker?.cpf || (caseData as any).workerCPF || "-"}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Dados da Empresa">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="text-base font-medium text-gray-900">
                {caseData.company?.name || (caseData as any).companyName || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CNPJ</p>
              <p className="text-base font-medium text-gray-900">
                {caseData.company?.cnpj || (caseData as any).companyCNPJ || "-"}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Documentos">
          <div className="space-y-3">
            {caseData.documents && caseData.documents.length > 0 ? (
              <ul className="list-disc list-inside text-sm text-gray-700">
                {caseData.documents.map((doc) => (
                  <li key={doc.id || doc.fileName || doc.type}>
                    <strong>{doc.type || "Documento"}</strong> - {doc.fileName || (doc as any).file || "(sem nome)"}
                    {doc.type && doc.type.toLowerCase() === "ppp" && (
                      <span className="ml-2 text-sm text-green-600">(PPP cadastrado)</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Nenhum documento cadastrado.</p>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:space-x-2 space-y-2 md:space-y-0">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="text-sm"
              />
              <Button onClick={handleUploadPPP} disabled={isUploading}>
                {isUploading ? "Enviando..." : "Enviar PPP"}
              </Button>
              {pppFileName && (
                <Button variant="secondary" onClick={handleDownloadPPP} disabled={isDownloadingPPP}>
                  {isDownloadingPPP ? "Baixando..." : "Baixar PPP"}
                </Button>
              )}
              <Button onClick={handleGenerateAnalysis} disabled={isGeneratingAnalysis}>
                {isGeneratingAnalysis ? "Gerando..." : "Gerar analise"}
              </Button>
              <Button onClick={handleDownloadReport} disabled={isDownloadingReport}>
                {isDownloadingReport ? "Baixando..." : "Baixar parecer"}
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Informacoes do Caso">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(caseData.status)}>
                  {formatCaseStatus(caseData.status)}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data de criacao</p>
              <p className="text-base font-medium text-gray-900">{formatDate(caseData.createdAt)}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Arquivo PPP</p>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <p className="text-base font-medium text-gray-900">{pppFileName || "Nenhum arquivo enviado"}</p>
                {pppFileName && (
                  <a
                    href={getPPPUrl(caseData.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 md:mt-0 ml-0 md:ml-4 px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500"
                  >
                    Ver PPP
                  </a>
                )}
              </div>
            </div>
          </div>
        </Card>

        {!analysis ? (
          <Card title="Analise do PPP">
            <p className="text-sm text-gray-500">
              Nenhuma analise gerada ainda. Clique no botao Gerar analise para iniciar.
            </p>
          </Card>
        ) : (
          <Card title="Analise do PPP">
            <div className="mb-6 pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Conclusao tecnica</p>
              <div className="flex items-center gap-3">
                <Badge variant={getFinalClassificationVariant(analysis.finalClassification)}>
                  {formatFinalClassification(analysis.finalClassification)}
                </Badge>
              </div>
            </div>

            {analysis.blocks && analysis.blocks.length > 0 ? (
              <div className="space-y-4">
                {analysis.blocks.map((block) => (
                  <div key={block.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-base font-semibold text-gray-900">{block.title}</h4>
                      <Badge variant={getBlockStatusVariant(block.status)}>
                        {formatBlockStatus(block.status)}
                      </Badge>
                    </div>

                    {block.status === "NOT_EVALUATED" ? (
                      <p className="text-sm text-gray-500">Bloco ainda nao avaliado.</p>
                    ) : block.findings && block.findings.length > 0 ? (
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
              <p className="text-sm text-gray-500">PPP ainda nao foi avaliado pelo motor de regras.</p>
            )}
          </Card>
        )}

        <div className="flex justify-end">
          <Button onClick={handleGenerateReport} disabled={generatingReport}>
            {generatingReport ? "Gerando..." : "Gerar parecer tecnico (PDF)"}
          </Button>
        </div>
      </div>
    </div>
  );
}
