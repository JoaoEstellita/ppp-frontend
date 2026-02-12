"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import {
  AdminOpsOverview,
  BillingMonth,
  generateBillingMonths,
  getAdminOpsOverview,
  getBillingMonths,
} from "@/src/services/api";

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
  const [opsOverview, setOpsOverview] = useState<AdminOpsOverview | null>(null);
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [opsPeriodDays, setOpsPeriodDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [opsLoading, setOpsLoading] = useState(true);
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

  const loadOpsOverview = useCallback(async (days: number) => {
    setOpsLoading(true);
    try {
      const data = await getAdminOpsOverview(days);
      setOpsOverview(data);
    } catch (err) {
      console.error("Erro ao carregar visao operacional:", err);
      setOpsOverview(null);
      setMessage({ type: "error", text: "Erro ao carregar visao operacional." });
    } finally {
      setOpsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpsOverview(opsPeriodDays);
  }, [loadOpsOverview, opsPeriodDays]);

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

  const opsSlaBreaches = useMemo(() => {
    if (!opsOverview) return 0;
    const b = opsOverview.sla.breaches;
    return b.awaiting_payment + b.awaiting_pdf + b.processing + b.error_open;
  }, [opsOverview]);

  const formatLatency = (seconds: number | null | undefined) => {
    if (!seconds || seconds < 0) return "-";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round((seconds / 60) * 10) / 10;
    return `${minutes} min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Relatorios mensais</h2>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => loadOpsOverview(opsPeriodDays)} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
            Atualizar operacao
          </Button>
          <Button onClick={() => load(yearMonth)} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
            Atualizar faturamento
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Visao operacional (SLA/SLO)</h3>
            <p className="text-sm text-gray-600">Monitoramento em tempo real da fila de casos e callbacks do n8n.</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Janela</label>
              <select
                value={opsPeriodDays}
                onChange={(e) => setOpsPeriodDays(Number(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value={1}>24h</option>
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
              </select>
            </div>
          </div>
        </div>

        {opsLoading ? (
          <div className="text-sm text-gray-500">Carregando visão operacional...</div>
        ) : !opsOverview ? (
          <div className="text-sm text-red-700 bg-red-50 p-3 rounded">Nao foi possivel carregar o panorama operacional.</div>
        ) : (
          <div className="space-y-4">
            {opsSlaBreaches > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
                <strong>Alerta SLA:</strong> existem {opsSlaBreaches} violacoes de SLA abertas no periodo atual.
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                Nenhuma violacao de SLA aberta no momento.
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Casos criados</div>
                <div className="text-2xl font-bold text-gray-900">{opsOverview.overview.created_cases}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Concluidos</div>
                <div className="text-2xl font-bold text-emerald-700">{opsOverview.overview.done_cases}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Callbacks sucesso</div>
                <div className="text-2xl font-bold text-blue-700">{opsOverview.overview.callback_success_count}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Latencia callback p50</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatLatency(opsOverview.overview.callback_latency_seconds_p50)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Latencia callback p95</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatLatency(opsOverview.overview.callback_latency_seconds_p95)}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border rounded p-3">
                <div className="text-xs text-gray-500">SLA estourado: aguardando pagamento</div>
                <div className={`text-xl font-semibold ${opsOverview.sla.breaches.awaiting_payment > 0 ? "text-red-700" : "text-gray-800"}`}>
                  {opsOverview.sla.breaches.awaiting_payment}
                </div>
              </div>
              <div className="bg-white border rounded p-3">
                <div className="text-xs text-gray-500">SLA estourado: aguardando PDF</div>
                <div className={`text-xl font-semibold ${opsOverview.sla.breaches.awaiting_pdf > 0 ? "text-red-700" : "text-gray-800"}`}>
                  {opsOverview.sla.breaches.awaiting_pdf}
                </div>
              </div>
              <div className="bg-white border rounded p-3">
                <div className="text-xs text-gray-500">SLA estourado: processamento</div>
                <div className={`text-xl font-semibold ${opsOverview.sla.breaches.processing > 0 ? "text-red-700" : "text-gray-800"}`}>
                  {opsOverview.sla.breaches.processing}
                </div>
              </div>
              <div className="bg-white border rounded p-3">
                <div className="text-xs text-gray-500">Suportes abertos</div>
                <div className={`text-xl font-semibold ${opsOverview.queues.open_support_requests > 0 ? "text-amber-700" : "text-gray-800"}`}>
                  {opsOverview.queues.open_support_requests}
                </div>
              </div>
            </div>
          </div>
        )}
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

      {opsOverview && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Top erros por codigo</div>
            {opsOverview.errors.top_error_codes.length === 0 ? (
              <p className="text-sm text-gray-500">Sem erros mapeados na janela atual.</p>
            ) : (
              <div className="space-y-2">
                {opsOverview.errors.top_error_codes.map((row) => (
                  <div key={row.code} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-gray-700">{row.code}</span>
                    <span className="text-red-700 font-semibold">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Top erros por etapa</div>
            {opsOverview.errors.top_error_steps.length === 0 ? (
              <p className="text-sm text-gray-500">Sem etapas com falha na janela atual.</p>
            ) : (
              <div className="space-y-2">
                {opsOverview.errors.top_error_steps.map((row) => (
                  <div key={row.step} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{row.step}</span>
                    <span className="text-red-700 font-semibold">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
