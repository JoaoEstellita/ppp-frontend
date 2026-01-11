"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getCases, FrontendCase, ApiError, CaseStatus } from "@/src/services/api";
import { Table } from "@/components/Table";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  awaiting_pdf: "Aguardando PDF",
  processing: "Processando",
  paid_processing: "Pago / Processando",
  done: "Concluido",
  pending_info: "Pendencias",
  error: "Erro",
};

function getStatusBadgeVariant(status: CaseStatus): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "done":
      return "success";
    case "processing":
    case "paid_processing":
      return "info";
    case "awaiting_payment":
    case "awaiting_pdf":
      return "warning";
    case "pending_info":
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

export default function OrgCasesPage() {
  const router = useRouter();
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";
  const [cases, setCases] = useState<FrontendCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    async function fetchCases() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCases(slug);
        setCases(data);
      } catch (err) {
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
  }, [slug]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Casos</h2>
        <Button onClick={() => router.push(`/s/${slug}/casos/novo`)}>Novo caso</Button>
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
          <Table headers={["ID", "Trabalhador", "Empresa", "Status", "Data de criacao"]}>
            {cases.map((caseItem) => (
              <tr 
                key={caseItem.id} 
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/s/${slug}/casos/${caseItem.id}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/s/${slug}/casos/${caseItem.id}`);
                  }
                }}
                role="link"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                  {caseItem.id.slice(0, 8)}...
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

