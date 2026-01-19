"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getReferralCases, ReferralCaseRow, ReferralCasesResponse } from "@/src/services/api";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";
import { Button } from "@/components/Button";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export default function ReferralCasesPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";
  const { org } = useOrgAccess();

  const [rows, setRows] = useState<ReferralCaseRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const loadCases = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const data: ReferralCasesResponse = await getReferralCases(org.id, { limit, offset });
      setRows(data.data ?? []);
      setCount(data.count ?? 0);
    } catch {
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [org?.id, offset]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const totalPages = useMemo(() => Math.max(Math.ceil(count / limit), 1), [count]);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Casos via código</h2>
          <p className="text-sm text-gray-600">
            Casos criados por trabalhadores usando o código do sindicato.
          </p>
        </div>
        <Link className="text-sm text-blue-600 hover:underline" href={`/s/${slug}/dashboard`}>
          Voltar ao dashboard
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500">Nenhum caso encontrado.</div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Caso</th>
                <th className="px-4 py-3 text-left">Trabalhador</th>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Criado em</th>
                <th className="px-4 py-3 text-left">Código</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link className="text-blue-600 hover:underline" href={`/s/${slug}/casos/${row.id}`}>
                      {row.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{row.worker?.name || "-"}</div>
                    <div className="text-xs text-gray-500">{row.worker?.cpf || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{row.company?.name || "-"}</div>
                    <div className="text-xs text-gray-500">{row.company?.cnpj || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.status || "-"}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3 text-gray-500">{row.union_code_applied || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          Página {currentPage} de {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setOffset(Math.max(offset - limit, 0))}
            disabled={offset === 0}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            onClick={() => setOffset(Math.min(offset + limit, (totalPages - 1) * limit))}
            disabled={offset + limit >= count}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
