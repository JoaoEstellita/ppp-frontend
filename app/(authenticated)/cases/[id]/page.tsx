"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCase, getCaseAnalysis, getPPPUrl, getReportUrl } from "@/lib/api";
import { Case, AnalysisResult } from "@/lib/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

interface PageProps {
  params: { id: string };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
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

const analysisBlocksConfig = [
  { key: "bloco_5_1" as const, title: "Bloco 5.1 - Dados do Trabalhador" },
  { key: "bloco_5_2" as const, title: "Bloco 5.2 - Dados da Empresa" },
  { key: "bloco_5_3" as const, title: "Bloco 5.3 - Função/Atividade" },
  { key: "bloco_5_4" as const, title: "Bloco 5.4 - Agentes de Risco" },
  { key: "bloco_5_5" as const, title: "Bloco 5.5 - Exames Médicos" },
];

export default function CaseDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = params;
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Buscar o caso
        const caseResult = await getCase(id);
        setCaseData(caseResult);

        // Buscar a análise
        try {
          const analysisResult = await getCaseAnalysis(id);
          setAnalysis(analysisResult);
        } catch (analysisError) {
          // Análise pode não existir ainda, não é erro crítico
          console.log("Análise não disponível ainda");
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
                {caseData.workerName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CPF</p>
              <p className="text-base font-medium text-gray-900">
                {caseData.workerCPF}
              </p>
            </div>
          </div>
        </Card>

  <Card title="Dados da Empresa">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="text-base font-medium text-gray-900">
                {caseData.companyName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CNPJ</p>
              <p className="text-base font-medium text-gray-900">
                {caseData.companyCNPJ}
              </p>
            </div>
          </div>
        </Card>

        {caseData.pppFileName && (
          <div className="flex justify-end mb-4">
            <Button
              variant="secondary"
              onClick={() => {
                const url = getPPPUrl(caseData.id);
                window.open(url, "_blank");
              }}
            >
              Ver PPP (PDF)
            </Button>
          </div>
        )}

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
                  {caseData.pppFileName || "Nenhum arquivo enviado"}
                </p>
                {caseData.pppFileName && (
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

        {analysis && (
          <Card title="Análise do PPP">
            <div className="space-y-4">
              {analysisBlocksConfig.map((blockConfig) => {
                const blockData = analysis.blocks[blockConfig.key];
                return (
                  <div
                    key={blockConfig.key}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-base font-semibold text-gray-900">
                        {blockConfig.title}
                      </h4>
                      <Badge variant={getStatusBadgeVariant(blockData.status)}>
                        {blockData.status}
                      </Badge>
                    </div>
                    {blockData.erros && blockData.erros.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {blockData.erros.map((erro, index) => (
                          <li key={index}>{erro}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Nenhum problema identificado.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
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

