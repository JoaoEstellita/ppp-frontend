"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { BillingMonth, generateBillingMonths, getBillingMonths } from "@/src/services/api";

const OPERATIONAL_COST_PER_CASE = Number(process.env.NEXT_PUBLIC_OPERATIONAL_COST_PER_CASE || 0);

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value || 0);
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function currentYearMonth(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export default function AdminReportsPage() {
  const [months, setMonths] = useState<BillingMonth[]>([]);
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async (selectedMonth?: string) => {
    setLoading(true);
    try {
      const data = await getBillingMonths(selectedMonth || undefined);
      setMonths(data);
    } catch (err) {
      console.error("Erro ao carregar relatorios:", err);
      setMonths([]);
      setMessage({ type: "error", text: "Erro ao carregar relatorios mensais." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(yearMonth);
  }, [load, yearMonth]);

  async function handleGenerate() {
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      setMessage({ type: "error", text: "Informe um mes valido no formato YYYY-MM." });
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const result = await generateBillingMonths(yearMonth);
      const generatedCount = result.items?.length ?? 0;
      setMessage({
        type: "success",
        text: `Snapshot gerado para ${yearMonth}. Organizacoes processadas: ${generatedCount}.`,
      });
      await load(yearMonth);
    } catch (err) {
      console.error("Erro ao gerar relatorios:", err);
      setMessage({ type: "error", text: "Erro ao gerar snapshot mensal." });
    } finally {
      setGenerating(false);
    }
  }

  const summary = useMemo(() => {
    return months.reduce(
      (acc, row) => {
        const paidCount = Number(row.paid_count || 0);
        const grossAmount = Number(row.gross_amount || 0);
        const shareAmount = Number(row.share_amount || 0);
        const platformRevenue = grossAmount - shareAmount;
        const operationalCost = paidCount * OPERATIONAL_COST_PER_CASE;
        const operationalMargin = platformRevenue - operationalCost;

        acc.paidCount += paidCount;
        acc.grossAmount += grossAmount;
        acc.shareAmount += shareAmount;
        acc.platformRevenue += platformRevenue;
        acc.operationalCost += operationalCost;
        acc.operationalMargin += operationalMargin;
        return acc;
      },
      {
        paidCount: 0,
        grossAmount: 0,
        shareAmount: 0,
        platformRevenue: 0,
        operationalCost: 0,
        operationalMargin: 0,
      }
    );
  }, [months]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Relatorios mensais</h2>
        <Button onClick={() => load(yearMonth)} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
          Atualizar
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="text-sm text-gray-600">Gerar e consultar snapshot por mes (YYYY-MM)</div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mes</label>
            <input
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              placeholder="YYYY-MM"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {generating ? "Gerando..." : "Gerar snapshot"}
          </Button>
        </div>
        {message && (
          <div
            className={`text-sm p-3 rounded ${
              message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Pagamentos aprovados</div>
          <div className="text-2xl font-bold text-gray-900">{summary.paidCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">GMV total</div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(summary.grossAmount)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Repasse total</div>
          <div className="text-2xl font-bold text-emerald-700">{formatMoney(summary.shareAmount)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Receita plataforma</div>
          <div className="text-2xl font-bold text-blue-700">{formatMoney(summary.platformRevenue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Margem operacional</div>
          <div className={`text-2xl font-bold ${summary.operationalMargin >= 0 ? "text-gray-900" : "text-red-700"}`}>
            {formatMoney(summary.operationalMargin)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Custo por PPP: {formatMoney(OPERATIONAL_COST_PER_CASE)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500">Carregando relatorios...</div>
        ) : months.length === 0 ? (
          <div className="p-6 text-gray-500">Nenhum relatorio encontrado para o filtro atual.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Mes</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Org ID</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Pagos</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">GMV</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Repasse</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Receita plataforma</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Margem</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {months.map((item) => {
                  const grossAmount = Number(item.gross_amount || 0);
                  const shareAmount = Number(item.share_amount || 0);
                  const paidCount = Number(item.paid_count || 0);
                  const platformRevenue = grossAmount - shareAmount;
                  const operationalMargin = platformRevenue - paidCount * OPERATIONAL_COST_PER_CASE;
                  return (
                    <tr key={`${item.org_id}-${item.year_month}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{item.year_month}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 font-mono">{item.org_id}</td>
                      <td className="px-4 py-2 text-gray-900">{paidCount}</td>
                      <td className="px-4 py-2 text-gray-900">{formatMoney(grossAmount)}</td>
                      <td className="px-4 py-2 text-emerald-700">{formatMoney(shareAmount)}</td>
                      <td className="px-4 py-2 text-blue-700">{formatMoney(platformRevenue)}</td>
                      <td className={`px-4 py-2 ${operationalMargin >= 0 ? "text-gray-900" : "text-red-700"}`}>
                        {formatMoney(operationalMargin)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {item.status || "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
