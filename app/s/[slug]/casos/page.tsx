"use client";

import { useEffect, useMemo, useState } from "react";
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
  const PAGE_SIZE = 12;
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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

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

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cases
      .filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) {
          return false;
        }
        if (normalizedQuery) {
          const idValue = (item.id || "").toLowerCase();
          const worker = (item.worker?.name || "").toLowerCase();
          const company = (item.company?.name || "").toLowerCase();
          if (!idValue.includes(normalizedQuery) && !worker.includes(normalizedQuery) && !company.includes(normalizedQuery)) {
            return false;
          }
        }
        if (fromDate) {
          const created = item.createdAt ? new Date(item.createdAt) : null;
          const from = new Date(`${fromDate}T00:00:00`);
          if (!created || created < from) return false;
        }
        if (toDate) {
          const created = item.createdAt ? new Date(item.createdAt) : null;
          const to = new Date(`${toDate}T23:59:59`);
          if (!created || created > to) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
  }, [cases, query, statusFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCases = filteredCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, fromDate, toDate]);

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Casos</h2>
        <Button onClick={() => router.push(`/s/${slug}/casos/novo`)}>Novo caso</Button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ID, trabalhador ou empresa"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "all")}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">Todos os status</option>
            <option value="awaiting_payment">Aguardando pagamento</option>
            <option value="awaiting_pdf">Aguardando PDF</option>
            <option value="processing">Processando</option>
            <option value="paid_processing">Pago / Processando</option>
            <option value="done">Concluído</option>
            <option value="pending_info">Pendências</option>
            <option value="error">Erro</option>
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{filteredCases.length} caso(s) encontrado(s)</span>
          <button onClick={clearFilters} className="text-blue-600 hover:underline">
            Limpar filtros
          </button>
        </div>
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
            {pagedCases.map((caseItem) => (
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
          {filteredCases.length === 0 && (
            <div className="p-6 text-sm text-gray-500">Nenhum caso para os filtros aplicados.</div>
          )}
          {filteredCases.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <span className="text-xs text-gray-500">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
