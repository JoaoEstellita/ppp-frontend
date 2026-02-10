"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { BillingMonth, generateBillingMonths, getBillingMonths } from "@/src/services/api";

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
      console.error("Erro ao carregar relatórios:", err);
      setMonths([]);
      setMessage({ type: "error", text: "Erro ao carregar relatórios mensais." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(yearMonth);
  }, [load, yearMonth]);

  async function handleGenerate() {
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      setMessage({ type: "error", text: "Informe um mês válido no formato YYYY-MM." });
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const result = await generateBillingMonths(yearMonth);
      const generatedCount = result.items?.length ?? 0;
      setMessage({
        type: "success",
        text: `Snapshot gerado para ${yearMonth}. Organizações processadas: ${generatedCount}.`,
      });
      await load(yearMonth);
    } catch (err) {
      console.error("Erro ao gerar relatórios:", err);
      setMessage({ type: "error", text: "Erro ao gerar snapshot mensal." });
    } finally {
      setGenerating(false);
    }
  }

  const summary = useMemo(() => {
    return months.reduce(
      (acc, row) => {
        acc.paidCount += Number(row.paid_count || 0);
        acc.grossAmount += Number(row.gross_amount || 0);
        acc.shareAmount += Number(row.share_amount || 0);
        return acc;
      },
      { paidCount: 0, grossAmount: 0, shareAmount: 0 }
    );
  }, [months]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Relatórios Mensais</h2>
        <Button onClick={() => load(yearMonth)} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
          Atualizar
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="text-sm text-gray-600">Gerar e consultar snapshot por mês (YYYY-MM)</div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mês</label>
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

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Pagamentos aprovados no período</div>
          <div className="text-2xl font-bold text-gray-900">{summary.paidCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Bruto total no período</div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(summary.grossAmount)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Repasse total no período</div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(summary.shareAmount)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500">Carregando relatórios...</div>
        ) : months.length === 0 ? (
          <div className="p-6 text-gray-500">Nenhum relatório encontrado para o filtro atual.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Mês</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Org ID</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Pagos</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Bruto</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">%</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Repasse</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {months.map((item) => (
                  <tr key={`${item.org_id}-${item.year_month}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{item.year_month}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">{item.org_id}</td>
                    <td className="px-4 py-2 text-gray-900">{item.paid_count}</td>
                    <td className="px-4 py-2 text-gray-900">{formatMoney(item.gross_amount)}</td>
                    <td className="px-4 py-2 text-gray-700">{Number(item.share_percent || 0) * 100}%</td>
                    <td className="px-4 py-2 text-gray-900">{formatMoney(item.share_amount)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        {item.status || "-"}
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
  );
}

