"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCases } from "@/lib/caseContext";
import { Table } from "@/components/Table";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { CaseStatus } from "@/lib/types";

function getStatusBadgeVariant(status: CaseStatus): "success" | "warning" | "danger" | "info" | "default" {
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR");
}

export default function CasesPage() {
  const router = useRouter();
  const { cases } = useCases();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Casos</h2>
        <Button onClick={() => router.push("/cases/new")}>Novo caso</Button>
      </div>

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
    </div>
  );
}

