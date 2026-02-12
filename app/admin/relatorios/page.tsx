"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import {
  AdminBillingControl,
  AdminOpsOverview,
  BillingMonth,
  generateBillingMonths,
  getAdminBillingControl,
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

function formatPercent(value: number | null | undefined): string {
  const amount = Number(value || 0);
  return `${amount.toFixed(1)}%`;
}

export default function AdminReportsPage() {
  const [months, setMonths] = useState<BillingMonth[]>([]);
  const [opsOverview, setOpsOverview] = useState<AdminOpsOverview | null>(null);
  const [billingControl, setBillingControl] = useState<AdminBillingControl | null>(null);
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

  const loadBillingControl = useCallback(async (days: number, selectedMonth?: string) => {
    try {
      const data = await getAdminBillingControl(days, selectedMonth);
      setBillingControl(data);
    } catch (err) {
      console.error("Erro ao carregar controle de cobranca:", err);
      setBillingControl(null);
      setMessage({ type: "error", text: "Erro ao carregar controle de cobranca." });
    }
  }, []);

  useEffect(() => {
    loadOpsOverview(opsPeriodDays);
  }, [loadOpsOverview, opsPeriodDays]);

  useEffect(() => {
    loadBillingControl(opsPeriodDays, yearMonth);
  }, [loadBillingControl, opsPeriodDays, yearMonth]);

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

  const opsHealth = useMemo(() => {
    if (!opsOverview) {
      return {
        completionRate: 0,
        callbackErrorRate: 0,
        queuePressure: 0,
        criticalItems: 0,
      };
    }

    const created = Number(opsOverview.overview.created_cases || 0);
    const done = Number(opsOverview.overview.done_cases || 0);
    const callbackSuccess = Number(opsOverview.overview.callback_success_count || 0);
    const callbackError = Number(opsOverview.overview.callback_error_count || 0);
    const callbackTotal = callbackSuccess + callbackError;

    const completionRate = created > 0 ? (done / created) * 100 : 0;
    const callbackErrorRate = callbackTotal > 0 ? (callbackError / callbackTotal) * 100 : 0;
    const queuePressure = Number(opsOverview.queues.open_cases_total || 0);
    const criticalItems =
      Number(opsOverview.sla.breaches.processing || 0) +
      Number(opsOverview.sla.breaches.error_open || 0) +
      Number(opsOverview.queues.open_support_requests || 0);

    return {
      completionRate,
      callbackErrorRate,
      queuePressure,
      criticalItems,
    };
  }, [opsOverview]);

  const cockpitAlerts = useMemo(() => {
    if (!opsOverview) return [];

    const alerts: Array<{ severity: "high" | "medium" | "low"; title: string; action: string }> = [];
    const breaches = opsOverview.sla.breaches;

    if (breaches.processing > 0) {
      alerts.push({
        severity: "high",
        title: `SLA de processamento estourado em ${breaches.processing} caso(s)`,
        action: "Priorizar retry e destravar callbacks pendentes imediatamente.",
      });
    }

    if (breaches.error_open > 0) {
      alerts.push({
        severity: "high",
        title: `${breaches.error_open} caso(s) em erro aberto`,
        action: "Executar triagem no suporte com reprocessamento assistido.",
      });
    }

    if (opsHealth.callbackErrorRate >= 5) {
      alerts.push({
        severity: "medium",
        title: `Taxa de erro de callback em ${formatPercent(opsHealth.callbackErrorRate)}`,
        action: "Revisar logs de webhook e latencia do gateway.",
      });
    }

    if (opsOverview.queues.open_support_requests > 0) {
      alerts.push({
        severity: "medium",
        title: `${opsOverview.queues.open_support_requests} suporte(s) aguardando`,
        action: "Aplicar fila por prioridade para reduzir tempo medio de resposta.",
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        severity: "low",
        title: "Operacao estavel",
        action: "Focar em automacoes de qualidade e melhoria de conversao.",
      });
    }

    return alerts;
  }, [opsOverview, opsHealth.callbackErrorRate]);

  const formatLatency = (seconds: number | null | undefined) => {
    if (!seconds || seconds < 0) return "-";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round((seconds / 60) * 10) / 10;
    return `${minutes} min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cockpit Operacional Unico</h2>
          <p className="text-sm text-gray-600">
            Fonte unica para cobranca, pipeline PPP, alertas de SLA e decisoes diarias.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => loadOpsOverview(opsPeriodDays)} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
            Atualizar operacao
          </Button>
          <Button onClick={() => loadBillingControl(opsPeriodDays, yearMonth)} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
            Atualizar cobranca
          </Button>
          <Button onClick={() => load(yearMonth)} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
            Atualizar faturamento
          </Button>
        </div>
      </div>

      {opsOverview && (
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Saude do pipeline</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{formatPercent(opsHealth.completionRate)}</div>
            <div className="mt-1 text-xs text-gray-600">Taxa de conclusao no periodo</div>
            <div className="mt-3 text-xs text-gray-600">
              Erro callback: <span className="font-semibold">{formatPercent(opsHealth.callbackErrorRate)}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Pressao de fila</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{opsHealth.queuePressure}</div>
            <div className="mt-1 text-xs text-gray-600">Casos em aberto na operacao</div>
            <div className="mt-3 text-xs text-gray-600">
              Itens criticos: <span className="font-semibold">{opsHealth.criticalItems}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Controle unico de cobranca</div>
            <div className="mt-2 text-sm font-semibold text-gray-900">
              Modelo atual: {billingControl?.billing_model.current || "pay_per_case"}
            </div>
            <div className="mt-1 text-xs text-gray-600">
              Alvo: {billingControl?.billing_model.target || "subscription_plus_usage"}
            </div>
            <div className="mt-3 text-xs text-gray-600">
              GMV: <span className="font-semibold">{formatMoney(opsOverview.finance.gmv_total)}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500">Acao recomendada hoje</div>
            <div className="mt-2 text-sm font-semibold text-gray-900">{cockpitAlerts[0]?.title || "Sem alertas"}</div>
            <div className="mt-2 text-xs text-gray-600">{cockpitAlerts[0]?.action || "-"}</div>
          </div>
        </div>
      )}

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

      {opsOverview && (
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Alertas operacionais e resposta</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {cockpitAlerts.map((alert, index) => (
              <div
                key={`${alert.title}-${index}`}
                className={`rounded border p-3 ${
                  alert.severity === "high"
                    ? "border-red-200 bg-red-50"
                    : alert.severity === "medium"
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-700">{alert.severity}</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{alert.title}</div>
                <div className="mt-1 text-xs text-gray-700">{alert.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Playbook 30 dias (melhor dos mundos)</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded border border-blue-200 bg-blue-50 p-3">
            <div className="text-xs font-semibold text-blue-700">Semana 1</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">Fonte unica de cobranca</div>
            <div className="mt-1 text-xs text-gray-700">
              Consolidar eventos de pagamento, faturamento e repasse em uma trilha unica auditavel.
            </div>
          </div>
          <div className="rounded border border-indigo-200 bg-indigo-50 p-3">
            <div className="text-xs font-semibold text-indigo-700">Semana 2-3</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">Confiabilidade de pipeline</div>
            <div className="mt-1 text-xs text-gray-700">
              Formalizar retry/backoff por etapa, com metas de SLA e painel de pendencias em tempo real.
            </div>
          </div>
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs font-semibold text-emerald-700">Semana 4</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">Experiencia premium</div>
            <div className="mt-1 text-xs text-gray-700">
              Exibir proxima melhor acao para usuario final e sindicato, reduzindo retrabalho e suporte.
            </div>
          </div>
        </div>
      </div>

      {billingControl && (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Controle unico de cobranca</h3>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded border border-gray-200 p-3">
              <div className="text-xs text-gray-500">Tentativas de pagamento</div>
              <div className="text-xl font-semibold text-gray-900">{billingControl.payment_funnel.total_attempted}</div>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <div className="text-xs text-gray-500">Aprovacao</div>
              <div className="text-xl font-semibold text-emerald-700">
                {formatPercent(billingControl.payment_funnel.approval_rate * 100)}
              </div>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <div className="text-xs text-gray-500">Pendentes +24h</div>
              <div className={`text-xl font-semibold ${billingControl.payment_funnel.pending_over_24h > 0 ? "text-red-700" : "text-gray-900"}`}>
                {billingControl.payment_funnel.pending_over_24h}
              </div>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <div className="text-xs text-gray-500">Margem mensal</div>
              <div className={`text-xl font-semibold ${billingControl.monthly_snapshot.operational_margin >= 0 ? "text-gray-900" : "text-red-700"}`}>
                {formatMoney(billingControl.monthly_snapshot.operational_margin)}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-900 mb-2">Funnel financeiro</div>
              <div className="space-y-1 text-xs text-gray-700">
                <div>Aprovados: {billingControl.payment_funnel.approved_count} ({formatMoney(billingControl.payment_funnel.approved_amount)})</div>
                <div>Pendentes: {billingControl.payment_funnel.pending_count} ({formatMoney(billingControl.payment_funnel.pending_amount)})</div>
                <div>Falhos: {billingControl.payment_funnel.failed_count} ({formatMoney(billingControl.payment_funnel.failed_amount)})</div>
                <div>Cancelados: {billingControl.payment_funnel.canceled_count}</div>
              </div>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-900 mb-2">Modelo alvo (single source)</div>
              <div className="space-y-1 text-xs text-gray-700">
                <div>Contrato: <span className="font-mono">{billingControl.billing_model.single_source_of_truth.contract_entity}</span></div>
                <div>Receita: <span className="font-mono">{billingControl.billing_model.single_source_of_truth.revenue_entity}</span></div>
                <div>Liquidação: <span className="font-mono">{billingControl.billing_model.single_source_of_truth.settlement_entity}</span></div>
                <div>Auditoria: <span className="font-mono">{billingControl.billing_model.single_source_of_truth.audit_entity}</span></div>
              </div>
            </div>
          </div>

          <div className="rounded border border-gray-200 p-3">
            <div className="text-sm font-semibold text-gray-900 mb-2">Acoes recomendadas</div>
            <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
              {billingControl.action_items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
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
