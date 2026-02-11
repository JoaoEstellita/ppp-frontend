"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getOrgMetrics, OrgMetrics } from "@/src/services/api";
import { Button } from "@/components/Button";

const UNION_EARNINGS_PER_CASE = 10;

function currentYearMonth(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value || 0);
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function totalCases(metrics: OrgMetrics | null): number {
  if (!metrics?.statusCounts) return 0;
  return Object.values(metrics.statusCounts).reduce((acc, value) => acc + Number(value || 0), 0);
}

function unionBalanceFromPaid(paidCount: number | null | undefined): number {
  return Number(paidCount || 0) * UNION_EARNINGS_PER_CASE;
}

function lastMonths(count: number): string[] {
  const base = new Date();
  const values: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    values.push(`${d.getFullYear()}-${month}`);
  }
  return values;
}

export default function OrgReportsPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [metrics, setMetrics] = useState<OrgMetrics | null>(null);
  const [history, setHistory] = useState<OrgMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSelectedMonth = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getOrgMetrics(slug, yearMonth);
      setMetrics(data);
    } catch (err) {
      console.error("Erro ao carregar relatório do mês:", err);
      setMetrics(null);
      setError("Não foi possível carregar os dados do mês selecionado.");
    } finally {
      setLoading(false);
    }
  }, [slug, yearMonth]);

  const loadHistory = useCallback(async () => {
    if (!slug) return;
    setHistoryLoading(true);
    try {
      const months = lastMonths(6);
      const responses = await Promise.all(
        months.map(async (month) => {
          try {
            return await getOrgMetrics(slug, month);
          } catch {
            return null;
          }
        })
      );
      setHistory(responses.filter((row): row is OrgMetrics => Boolean(row)));
    } finally {
      setHistoryLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadSelectedMonth();
  }, [loadSelectedMonth]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const statusRows = useMemo(() => {
    if (!metrics?.statusCounts) return [];
    return Object.entries(metrics.statusCounts)
      .map(([status, count]) => ({
        status,
        count: Number(count || 0),
      }))
      .sort((a, b) => b.count - a.count);
  }, [metrics]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Relatórios</h2>
        <Button onClick={() => { loadSelectedMonth(); loadHistory(); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
          Atualizar
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="text-sm text-gray-700 font-medium">Período de análise</div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mês (YYYY-MM)</label>
            <input
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="2026-02"
            />
          </div>
          <Button onClick={loadSelectedMonth} className="bg-blue-600 hover:bg-blue-700 text-white">
            Aplicar
          </Button>
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Casos no mês</div>
          <div className="text-2xl font-bold text-gray-900">{loading ? "-" : totalCases(metrics)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Pagamentos aprovados</div>
          <div className="text-2xl font-bold text-gray-900">{loading ? "-" : metrics?.paidCount ?? 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Saldo do sindicato</div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? "-" : formatMoney(unionBalanceFromPaid(metrics?.paidCount))}
          </div>
          <div className="text-xs text-gray-500 mt-1">R$ 10,00 por PPP pago</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Pagos via código</div>
          <div className="text-2xl font-bold text-gray-900">{loading ? "-" : metrics?.referralPaidCount ?? 0}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Distribuição por status ({metrics?.year_month || yearMonth})</h3>
          {loading ? (
            <div className="text-sm text-gray-500">Carregando...</div>
          ) : statusRows.length === 0 ? (
            <div className="text-sm text-gray-500">Sem casos no período selecionado.</div>
          ) : (
            <div className="space-y-2">
              {statusRows.map((item) => (
                <div key={item.status} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                  <span className="text-sm text-gray-700">{item.status}</span>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Últimos 6 meses</h3>
          {historyLoading ? (
            <div className="text-sm text-gray-500">Carregando histórico...</div>
          ) : history.length === 0 ? (
            <div className="text-sm text-gray-500">Sem dados históricos.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Mês</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Casos</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Pagos</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Saldo sindicato</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((row) => (
                    <tr key={row.year_month} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{row.year_month}</td>
                      <td className="px-3 py-2 text-gray-700">{totalCases(row)}</td>
                      <td className="px-3 py-2 text-gray-700">{row.paidCount ?? 0}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {formatMoney(unionBalanceFromPaid(row.paidCount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
