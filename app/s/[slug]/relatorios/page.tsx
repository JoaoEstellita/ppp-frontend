"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getOrgMetrics, OrgMetrics } from "@/src/services/api";
import { Button } from "@/components/Button";

const UNION_EARNINGS_PER_CASE = 10;
const OPERATIONAL_COST_PER_CASE = Number(process.env.NEXT_PUBLIC_OPERATIONAL_COST_PER_CASE || 0);
const CLOSING_DAY = 5;

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

function unionShareFromPaid(paidCount: number | null | undefined): number {
  return Number(paidCount || 0) * UNION_EARNINGS_PER_CASE;
}

function monthLabel(value: string): string {
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
}

function monthStatus(yearMonth: string): "aberto" | "fechado" {
  const current = currentYearMonth();
  return yearMonth < current ? "fechado" : "aberto";
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

type FinancialRow = {
  year_month: string;
  paidCount: number;
  grossAmount: number;
  unionShare: number;
  platformRevenue: number;
  estimatedOperationalCost: number;
  operationalMargin: number;
  closingStatus: "aberto" | "fechado";
};

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
      console.error("Erro ao carregar relatorio do mes:", err);
      setMetrics(null);
      setError("Nao foi possivel carregar os dados do mes selecionado.");
    } finally {
      setLoading(false);
    }
  }, [slug, yearMonth]);

  const loadHistory = useCallback(async () => {
    if (!slug) return;
    setHistoryLoading(true);
    try {
      const months = lastMonths(12);
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

  const selectedPaidCount = Number(metrics?.paidCount || 0);
  const selectedGross = Number(metrics?.grossAmount || 0);
  const selectedUnionShare = unionShareFromPaid(selectedPaidCount);
  const selectedPlatformRevenue = selectedGross - selectedUnionShare;
  const selectedOperationalCost = selectedPaidCount * OPERATIONAL_COST_PER_CASE;
  const selectedOperationalMargin = selectedPlatformRevenue - selectedOperationalCost;

  const monthlyStatement = useMemo<FinancialRow[]>(() => {
    return history
      .map((row) => {
        const paidCount = Number(row.paidCount || 0);
        const grossAmount = Number(row.grossAmount || 0);
        const unionShare = unionShareFromPaid(paidCount);
        const platformRevenue = grossAmount - unionShare;
        const estimatedOperationalCost = paidCount * OPERATIONAL_COST_PER_CASE;
        const operationalMargin = platformRevenue - estimatedOperationalCost;
        return {
          year_month: row.year_month,
          paidCount,
          grossAmount,
          unionShare,
          platformRevenue,
          estimatedOperationalCost,
          operationalMargin,
          closingStatus: monthStatus(row.year_month),
        };
      })
      .sort((a, b) => (a.year_month < b.year_month ? 1 : -1));
  }, [history]);

  const openReceivable = useMemo(() => {
    return monthlyStatement
      .filter((row) => row.closingStatus === "aberto")
      .reduce((sum, row) => sum + row.unionShare, 0);
  }, [monthlyStatement]);

  const totalGmv = useMemo(
    () => monthlyStatement.reduce((sum, row) => sum + row.grossAmount, 0),
    [monthlyStatement]
  );
  const totalPlatformRevenue = useMemo(
    () => monthlyStatement.reduce((sum, row) => sum + row.platformRevenue, 0),
    [monthlyStatement]
  );
  const totalUnionShare = useMemo(
    () => monthlyStatement.reduce((sum, row) => sum + row.unionShare, 0),
    [monthlyStatement]
  );
  const totalOperationalMargin = useMemo(
    () => monthlyStatement.reduce((sum, row) => sum + row.operationalMargin, 0),
    [monthlyStatement]
  );

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
        <h2 className="text-2xl font-bold text-gray-900">Relatorios</h2>
        <Button
          onClick={() => {
            loadSelectedMonth();
            loadHistory();
          }}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          Atualizar
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="text-sm text-gray-700 font-medium">Periodo de analise</div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mes (YYYY-MM)</label>
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

      <div className="bg-white rounded-lg shadow p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Politica de repasse do sindicato</h3>
        <p className="text-sm text-gray-700">
          Cada PPP pago gera repasse fixo de <strong>R$ 10,00</strong> para o sindicato.
        </p>
        <p className="text-xs text-gray-500">
          Fechamento mensal: todo dia {CLOSING_DAY}. Meses anteriores aparecem como fechado; mes atual permanece aberto ate o fechamento.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Saldo a receber ({monthLabel(yearMonth)})</div>
          <div className="text-2xl font-bold text-gray-900">{loading ? "-" : formatMoney(selectedUnionShare)}</div>
          <div className="text-xs text-gray-500 mt-1">R$ 10,00 por PPP pago</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Saldo em aberto (extrato)</div>
          <div className="text-2xl font-bold text-amber-700">
            {historyLoading ? "-" : formatMoney(openReceivable)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Somatorio dos meses em aberto</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Pagamentos aprovados</div>
          <div className="text-2xl font-bold text-gray-900">{loading ? "-" : selectedPaidCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Casos no mes</div>
          <div className="text-2xl font-bold text-gray-900">{loading ? "-" : totalCases(metrics)}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">GMV ({monthLabel(yearMonth)})</div>
          <div className="text-2xl font-bold text-gray-900">{loading ? "-" : formatMoney(selectedGross)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Receita plataforma</div>
          <div className="text-2xl font-bold text-blue-700">
            {loading ? "-" : formatMoney(selectedPlatformRevenue)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Repasse sindicato</div>
          <div className="text-2xl font-bold text-emerald-700">
            {loading ? "-" : formatMoney(selectedUnionShare)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Margem operacional estimada</div>
          <div
            className={`text-2xl font-bold ${
              selectedOperationalMargin >= 0 ? "text-gray-900" : "text-red-700"
            }`}
          >
            {loading ? "-" : formatMoney(selectedOperationalMargin)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Custo operacional por PPP: {formatMoney(OPERATIONAL_COST_PER_CASE)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Separacao de indicadores (ultimos 12 meses)</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500">GMV total</div>
            <div className="text-xl font-bold text-gray-900">{formatMoney(totalGmv)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Receita plataforma</div>
            <div className="text-xl font-bold text-blue-700">{formatMoney(totalPlatformRevenue)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Repasse sindicato</div>
            <div className="text-xl font-bold text-emerald-700">{formatMoney(totalUnionShare)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Margem operacional</div>
            <div
              className={`text-xl font-bold ${
                totalOperationalMargin >= 0 ? "text-gray-900" : "text-red-700"
              }`}
            >
              {formatMoney(totalOperationalMargin)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Distribuicao por status ({metrics?.year_month || yearMonth})
          </h3>
          {loading ? (
            <div className="text-sm text-gray-500">Carregando...</div>
          ) : statusRows.length === 0 ? (
            <div className="text-sm text-gray-500">Sem casos no periodo selecionado.</div>
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
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Extrato mensal de repasse</h3>
          {historyLoading ? (
            <div className="text-sm text-gray-500">Carregando extrato...</div>
          ) : monthlyStatement.length === 0 ? (
            <div className="text-sm text-gray-500">Sem dados historicos.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Mes</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Pagos</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">GMV</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Repasse</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {monthlyStatement.map((row) => (
                    <tr key={row.year_month} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{monthLabel(row.year_month)}</td>
                      <td className="px-3 py-2 text-gray-700">{row.paidCount}</td>
                      <td className="px-3 py-2 text-gray-700">{formatMoney(row.grossAmount)}</td>
                      <td className="px-3 py-2 text-emerald-700 font-semibold">{formatMoney(row.unionShare)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs ${
                            row.closingStatus === "fechado"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {row.closingStatus}
                        </span>
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
