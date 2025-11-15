"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useCases } from "@/lib/caseContext";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

interface PageProps {
  params: Promise<{ id: string }>;
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
    case "GENÉRICO":
      return "warning";
    default:
      return "default";
  }
}

const analysisBlocks = [
  {
    id: "5.1",
    title: "Bloco 5.1 - Dados do Trabalhador",
    status: "COMPLETO",
    problems: [
      "Todos os dados do trabalhador estão preenchidos corretamente.",
    ],
  },
  {
    id: "5.2",
    title: "Bloco 5.2 - Dados da Empresa",
    status: "INCOMPLETO",
    problems: [
      "CNPJ não corresponde ao cadastro na Receita Federal.",
      "Razão social divergente.",
    ],
  },
  {
    id: "5.3",
    title: "Bloco 5.3 - Função/Atividade",
    status: "GENÉRICO",
    problems: [
      "Descrição da função muito genérica.",
      "Falta especificação das atividades realizadas.",
    ],
  },
  {
    id: "5.4",
    title: "Bloco 5.4 - Agentes de Risco",
    status: "COMPLETO",
    problems: [
      "Agentes de risco identificados corretamente.",
    ],
  },
  {
    id: "5.5",
    title: "Bloco 5.5 - Exames Médicos",
    status: "INCOMPLETO",
    problems: [
      "Falta exame de audiometria.",
      "Exame de acuidade visual vencido.",
    ],
  },
];

export default function CaseDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { getCaseById } = useCases();
  const caseItem = getCaseById(resolvedParams.id);

  if (!caseItem) {
    return (
      <div>
        <p className="text-red-600">Caso não encontrado.</p>
        <Button onClick={() => router.push("/cases")} className="mt-4">
          Voltar para lista
        </Button>
      </div>
    );
  }

  const handleGeneratePDF = () => {
    alert("Funcionalidade em desenvolvimento");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Caso #{caseItem.id}
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
                {caseItem.workerName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CPF</p>
              <p className="text-base font-medium text-gray-900">
                {caseItem.workerCPF}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Dados da Empresa">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="text-base font-medium text-gray-900">
                {caseItem.companyName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CNPJ</p>
              <p className="text-base font-medium text-gray-900">
                {caseItem.companyCNPJ}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Informações do Caso">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(caseItem.status)}>
                  {caseItem.status}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data de Criação</p>
              <p className="text-base font-medium text-gray-900">
                {formatDate(caseItem.createdAt)}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Arquivo PPP</p>
              <p className="text-base font-medium text-gray-900">
                {caseItem.pppFileName}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Análise do PPP">
          <div className="space-y-4">
            {analysisBlocks.map((block) => (
              <div
                key={block.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-base font-semibold text-gray-900">
                    {block.title}
                  </h4>
                  <Badge variant={getStatusBadgeVariant(block.status)}>
                    {block.status}
                  </Badge>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {block.problems.map((problem, index) => (
                    <li key={index}>{problem}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleGeneratePDF}>
            Gerar Parecer Técnico (PDF)
          </Button>
        </div>
      </div>
    </div>
  );
}

