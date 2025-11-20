"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCases, FrontendCase, FinalClassification, ApiError, CaseStatus } from "@/src/services/api";
import { Table } from "@/components/Table";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

const STATUS_LABELS: Record<CaseStatus, string> = {
  pending_documents: "Aguardando documentos",
  processing: "Em analise automatica",
  analyzed: "Analise concluida",
  error: "Erro na analise",
};

function getStatusBadgeVariant(status: CaseStatus): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
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

function formatStatusLabel(status: CaseStatus): string {
  return STATUS_LABELS[status] ?? status;
}

function formatFinalClassification(value: FinalClassification | string | undefined): string {
  switch (value) {
    case "ATENDE_INTEGRALMENTE":
      return "Atende";
    case "POSSUI_INCONSISTENCIAS_SANAVEIS":
      return "Com inconsistencias";
    case "NAO_POSSUI_VALIDADE_TECNICA":
      return "Nao valido";
    default:
      return "Nao avaliado";
  }
}

function getFinalClassificationVariant(value: FinalClassification | string | undefined): "success" | "warning" | "danger" | "info" | "default" {
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<FrontendCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCases() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCases();
        setCases(data);
      } catch (err) {
        console.error("Erro ao buscar casos:", err);
        if (err instanceof ApiError) {
          setError(err.message || "Nao foi possivel carregar os casos.");
        } else {
          setError("Nao foi possivel carregar os casos.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCases();
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Casos</h2>
        <Button onClick={() => router.push("/cases/new")}>Novo caso</Button>
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-600">Carregando casos...</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <Table
            headers={["ID", "Trabalhador", "Empresa", "Status", "Conclusao", "Data de criacao"]}
          >
            {cases.map((caseItem) => (
              <tr key={caseItem.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <Link
                    href={`/cases/${caseItem.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {caseItem.id}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {caseItem.worker?.name || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {caseItem.company?.name || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Badge variant={getStatusBadgeVariant(caseItem.status as CaseStatus)}>
                    {formatStatusLabel(caseItem.status as CaseStatus)}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Badge variant={getFinalClassificationVariant(caseItem.analysis?.finalClassification)}>
                    {formatFinalClassification(caseItem.analysis?.finalClassification)}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(caseItem.createdAt)}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
