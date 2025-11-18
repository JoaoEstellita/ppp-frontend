"use client";

import { useState, useEffect } from "react";
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
} from "@/src/services/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

interface PageProps {
  params: { id: string };
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

function getStatusBadgeVariant(
  status: string
): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "COMPLETO":
      return "success";
    case "EM_ANALISE":
      return "info";
    case "INCOMPLETO":
      return "danger";
    default:
      return "default";
  }
}

function formatFinalClassification(value: FinalClassification | undefined): string {
  switch (value) {
    case 'ATENDE_INTEGRALMENTE':
      return 'ATENDE integralmente às exigências técnicas';
    case 'POSSUI_INCONSISTENCIAS_SANAVEIS':
      return 'Possui inconsistências sanáveis';
    case 'NAO_POSSUI_VALIDADE_TECNICA':
      return 'Não possui validade técnica';
    default:
      return 'Não avaliado';
  }
}

function formatBlockStatus(value: BlockStatus | undefined): string {
  switch (value) {
    case 'APPROVED':
      return 'APROVADO';
    case 'PENDING':
      return 'COM PENDÊNCIAS';
    case 'REPROVED':
      return 'REPROVADO';
    case 'NOT_EVALUATED':
    default:
      return 'NÃO AVALIADO';
  }
}

function getBlockStatusVariant(value: BlockStatus | undefined): "success" | "warning" | "danger" | "info" | "default" {
  switch (value) {
    case 'APPROVED':
      return 'success';       // verde
    case 'PENDING':
      return 'warning';       // amarelo
    case 'REPROVED':
      return 'danger';        // vermelho
    case 'NOT_EVALUATED':
    default:
      return 'info';          // azul/cinza neutro
  }
}

function getFinalClassificationVariant(value: FinalClassification | undefined): "success" | "warning" | "danger" | "info" | "default" {
  switch (value) {
    case 'ATENDE_INTEGRALMENTE':
      return 'success';
    case 'POSSUI_INCONSISTENCIAS_SANAVEIS':
      return 'warning';
    case 'NAO_POSSUI_VALIDADE_TECNICA':
      return 'danger';
    default:
      return 'info';
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
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Buscar o caso
        const caseResult = await getCaseById(id);
        setCaseData(caseResult);

        // Se a API já retornar uma análise embutida no case
        if ((caseResult as any).analysis) {
          setAnalysis((caseResult as any).analysis as AnalysisResult);
        }
      } catch (err) {
        setError("Não foi possível carregar os detalhes do caso.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const handleGenerateReport = () => {
    if (!caseData) return;

    setGeneratingReport(true);
    const url = getReportUrl(caseData.id);
    window.open(url, "_blank", "noopener,noreferrer");

    // Resetar o estado após um breve delay
    setTimeout(() => {
      setGeneratingReport(false);
    }, 1000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) setSelectedFile(files[0]);
    else setSelectedFile(null);
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
      alert("Upload concluído com sucesso.");
      const updated = await getCaseById(caseData.id);
      setCaseData(updated);
      if ((updated as any).analysis) setAnalysis((updated as any).analysis as AnalysisResult);
    } catch (err) {
      console.error(err);
      alert("Falha ao enviar PPP.");
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
      router.refresh();
      alert("Análise gerada com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Falha ao gerar análise.");
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
      const a = document.createElement("a");
      a.href = url;
      a.download = `ppp_${caseData.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Falha ao baixar o PPP.");
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
      const a = document.createElement("a");
      a.href = url;
      a.download = `parecer_${caseData.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || String(err);
      if (msg.includes("501") || msg.toLowerCase().includes("not implemented")) {
        alert("Relatório ainda não disponível.");
      } else {
        alert("Falha ao baixar o relatório.");
      }
    } finally {
      setIsDownloadingReport(false);
    }
  };

  // Informações derivadas
  const pppDoc = caseData?.documents?.find(
    (d) => (d.type || "").toString().toLowerCase() === "ppp"
  );
  const pppFileName = pppDoc?.fileName || (caseData as any)?.pppFileName;

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-600">
        Carregando detalhes do caso...
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div>
        <p className="text-red-600">
          {error || "Caso não encontrado."}
        </p>
        <Button onClick={() => router.push("/cases")} className="mt-4">
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Caso #{caseData.id}
        </h2>
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
                {caseData.documents.map((doc: any) => (
                  <li key={doc.id}>
                    <strong>{doc.type}</strong> - {doc.fileName || doc.file || "(sem nome)"}
                    {doc.type && doc.type.toLowerCase() === "ppp" && (
                      <span className="ml-2 text-sm text-green-600">(PPP cadastrado)</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Nenhum documento cadastrado.</p>
            )}

            <div className="flex items-center space-x-2 mt-2">
              <input type="file" accept="application/pdf" onChange={handleFileChange} />
              <Button onClick={handleUploadPPP} disabled={isUploading}>
                {isUploading ? "Enviando..." : "Enviar PPP"}
              </Button>
              {pppFileName && (
                <Button variant="secondary" onClick={handleDownloadPPP} disabled={isDownloadingPPP}>
                  {isDownloadingPPP ? "Baixando..." : "Baixar PPP"}
                </Button>
              )}
              <Button onClick={handleGenerateAnalysis} disabled={isGeneratingAnalysis}>
                {isGeneratingAnalysis ? "Gerando..." : "Gerar análise (motor de regras)"}
              </Button>
              <Button onClick={handleDownloadReport} disabled={isDownloadingReport}>
                {isDownloadingReport ? "Baixando..." : "Baixar parecer (PDF)"}
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Informações do Caso">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(caseData.status)}>
                  {caseData.status}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data de Criação</p>
                <p className="text-base font-medium text-gray-900">
                {formatDate(caseData.createdAt)}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Arquivo PPP</p>
              <div className="flex items-center justify-between">
                <p className="text-base font-medium text-gray-900">
                  {pppFileName || "Nenhum arquivo enviado"}
                </p>
                {pppFileName && (
                  <a
                    href={getPPPUrl(caseData.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500"
                  >
                    Ver PPP
                  </a>
                )}
              </div>
            </div>
          </div>
        </Card>

        {!analysis ? (
          <Card title="Análise do PPP">
            <p className="text-sm text-gray-500">
              Nenhuma análise gerada ainda. Clique em &apos;Gerar análise (motor de regras)&apos; para iniciar.
            </p>
          </Card>
        ) : (
          <Card title="Análise do PPP">
            {/* Conclusão técnica */}
            <div className="mb-6 pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Conclusão técnica</p>
              <div className="flex items-center gap-3">
                <Badge variant={getFinalClassificationVariant(analysis.finalClassification)}>
                  {formatFinalClassification(analysis.finalClassification)}
                </Badge>
              </div>
            </div>

            {/* Blocos de análise */}
            {analysis.blocks && analysis.blocks.length > 0 ? (
              <div className="space-y-4">
                {analysis.blocks.map((block) => (
                  <div
                    key={block.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-base font-semibold text-gray-900">
                        {block.title}
                      </h4>
                      <Badge variant={getBlockStatusVariant(block.status)}>
                        {formatBlockStatus(block.status)}
                      </Badge>
                    </div>

                    {block.status === 'NOT_EVALUATED' ? (
                      <p className="text-sm text-gray-500">
                        Bloco ainda não avaliado nesta versão (sem regras automatizadas).
                      </p>
                    ) : block.findings && block.findings.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {block.findings.map((finding) => (
                          <li key={finding.code}>
                            {finding.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Nenhum problema identificado.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                PPP ainda não foi avaliado pelo motor de regras.
              </p>
            )}
          </Card>
        )}

        <div className="flex justify-end">
          <Button onClick={handleGenerateReport} disabled={generatingReport}>
            {generatingReport ? "Gerando..." : "Gerar Parecer Técnico (PDF)"}
          </Button>
        </div>
      </div>
    </div>
  );
}

