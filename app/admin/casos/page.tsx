"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import {
  adminListCases,
  adminRetryCase,
  AdminCaseItem,
} from "@/src/services/api";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "awaiting_payment", label: "Aguardando pagamento" },
  { value: "awaiting_pdf", label: "Aguardando PDF" },
  { value: "processing", label: "Processando" },
  { value: "done", label: "Concluído" },
  { value: "error", label: "Erro" },
];

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  awaiting_pdf: "Aguardando PDF",
  processing: "Processando",
  paid_processing: "Pago / Processando",
  done: "Concluído",
  pending_info: "Pendências",
  error: "Erro",
};

function getStatusBadgeVariant(status: string): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "done":
      return "success";
    case "processing":
    case "paid_processing":
      return "info";
    case "awaiting_payment":
    case "awaiting_pdf":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export default function AdminCasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<AdminCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const status = searchParams?.get("status");
    const orgId = searchParams?.get("org_id");
    if (status) setFilter(status);
    if (orgId) setOrgFilter(orgId);
  }, [searchParams]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminListCases({
        status: filter,
        orgId: orgFilter || undefined,
      });
      setCases(data);
    } catch (err) {
      console.error("Erro ao carregar casos:", err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [filter, orgFilter]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleRetry = async (caseId: string) => {
    setActionLoading(`retry-${caseId}`);
    setMessage(null);
    try {
      const result = await adminRetryCase(caseId);
      setMessage({ type: "success", text: result.message });
      await loadCases();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao reprocessar." });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Todos os Casos</h2>
        <div className="flex items-center gap-2">
          <input
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value.trim())}
            placeholder="Org ID (opcional)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            onClick={loadCases}
            disabled={loading}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div className={`p-3 rounded text-sm ${
          message.type === "success"
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      {/* Lista de casos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <span className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-2">Carregando casos...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Nenhum caso encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Sindicato</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Trabalhador</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Criado em</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cases.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/casos/${item.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-blue-600 font-medium">
                        {item.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.org_name ?? "-"}</div>
                      <div className="text-xs text-gray-500">/{item.org_slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{item.worker_name ?? "-"}</div>
                      <div className="text-xs text-gray-500">{item.worker_cpf ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{item.company_name ?? "-"}</div>
                      <div className="text-xs text-gray-500">{item.company_cnpj ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(item.status)}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/s/${item.org_slug}/casos/${item.id}`}
                          className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          Ver como sindicato
                        </Link>
                        {item.status === "error" && (
                          <button
                            onClick={() => handleRetry(item.id)}
                            disabled={actionLoading === `retry-${item.id}`}
                            className="px-3 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === `retry-${item.id}` ? "..." : "Reprocessar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
