"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCases } from "@/lib/api";
import { Case, CaseStatus } from "@/lib/types";
import { Table } from "@/components/Table";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

function getStatusBadgeVariant(status: CaseStatus): "success" | "warning" | "danger" | "info" | "default" {
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR");
}

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
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
        setError("Não foi possível carregar os casos.");
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
        <div className="text-center py-8 text-gray-600">
          Carregando casos...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <Table
            headers={["ID", "Trabalhador", "Empresa", "Status", "Data de criação"]}
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
                  {caseItem.workerName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {caseItem.companyName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Badge variant={getStatusBadgeVariant(caseItem.status)}>
                    {caseItem.status}
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

