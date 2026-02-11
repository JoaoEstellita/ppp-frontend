"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getCases,
  getOrgMetrics,
  getOrgUnionCode,
  updateOrgUnionCode,
  getOrganizations,
  OrgMetrics,
  FrontendCase,
} from "@/src/services/api";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";
import { useAuth } from "@/lib/authContext";

const UNION_EARNINGS_PER_CASE = 10;
const AUDIT_LIMIT = 12;

type PeriodMode = "current" | "previous" | "custom";

type DashboardAuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  awaiting_pdf: "Aguardando PDF",
  ready_to_process: "Pronto para envio",
  processing: "Processando",
  paid_processing: "Pago / Processando",
  done: "Concluido",
  pending_info: "Pendencias",
  error: "Erro",
};

function toYearMonth(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function currentYearMonth(): string {
  return toYearMonth(new Date());
}

function previousYearMonth(): string {
  const now = new Date();
  return toYearMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

function yearMonthLabel(value: string): string {
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
}

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value || 0);
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

function totalCases(metrics: OrgMetrics | null): number {
  if (!metrics?.statusCounts) return 0;
  return Object.values(metrics.statusCounts).reduce((acc, value) => acc + Number(value || 0), 0);
}

function generateUnionCode(seed = "SINDICATO"): string {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${seed.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 10)}-${token}`;
}

function auditStorageKey(slug: string): string {
  return `org_dashboard_audit_${slug}`;
}

function readAudit(slug: string): DashboardAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(auditStorageKey(slug));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAudit(slug: string, entries: DashboardAuditEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(auditStorageKey(slug), JSON.stringify(entries.slice(0, AUDIT_LIMIT)));
  } catch {
    // ignore
  }
}

export default function OrgDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const { user } = useAuth();
  const { org, isPlatformAdmin } = useOrgAccess();

  const [periodMode, setPeriodMode] = useState<PeriodMode>("current");
  const [customYearMonth, setCustomYearMonth] = useState(currentYearMonth());

  const activeYearMonth =
    periodMode === "current"
      ? currentYearMonth()
      : periodMode === "previous"
      ? previousYearMonth()
      : customYearMonth;

  const [metrics, setMetrics] = useState<OrgMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [allCases, setAllCases] = useState<FrontendCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  const [history, setHistory] = useState<OrgMetrics[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [targetOrgId, setTargetOrgId] = useState<string | null>(null);
  const [unionCode, setUnionCode] = useState("");
  const [unionCodeActive, setUnionCodeActive] = useState(true);
  const [unionCodeMessage, setUnionCodeMessage] = useState<string | null>(null);
  const [savingUnionCode, setSavingUnionCode] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [auditLog, setAuditLog] = useState<DashboardAuditEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const appendAudit = useCallback(
    (entry: Omit<DashboardAuditEntry, "id" | "at">) => {
      if (!slug) return;
      const next: DashboardAuditEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        ...entry,
      };
      const merged = [next, ...auditLog].slice(0, AUDIT_LIMIT);
      setAuditLog(merged);
      writeAudit(slug, merged);
    },
    [auditLog, slug]
  );

  const loadMetrics = useCallback(async () => {
    if (!slug) return;
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const data = await getOrgMetrics(slug, activeYearMonth);
      setMetrics(data);
      setUpdatedAt(new Date().toISOString());
    } catch {
      setMetrics(null);
      setMetricsError("Nao foi possivel carregar os indicadores deste periodo.");
    } finally {
      setMetricsLoading(false);
    }
  }, [slug, activeYearMonth]);

  const loadCases = useCallback(async () => {
    if (!slug) return;
    setCasesLoading(true);
    try {
      const data = await getCases(slug);
      setAllCases(data);
    } catch {
      setAllCases([]);
    } finally {
      setCasesLoading(false);
    }
  }, [slug]);

  const loadHistory = useCallback(async () => {
    if (!slug) return;
    setHistoryLoading(true);
    try {
      const now = new Date();
      const months = Array.from({ length: 12 }).map((_, i) =>
        toYearMonth(new Date(now.getFullYear(), now.getMonth() - i, 1))
      );
      const rows = await Promise.all(
        months.map(async (month) => {
          try {
            return await getOrgMetrics(slug, month);
          } catch {
            return null;
          }
        })
      );
      setHistory(rows.filter((row): row is OrgMetrics => Boolean(row)));
    } finally {
      setHistoryLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    setAuditLog(readAudit(slug));
  }, [slug]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!slug) return;
    if (isPlatformAdmin) {
      getOrganizations()
        .then((orgs) => {
          const match = orgs.find((item) => item.slug === slug);
          setTargetOrgId(match?.id || null);
        })
        .catch(() => setTargetOrgId(null));
      return;
    }

    if (org?.id) {
      setTargetOrgId(org.id);
    }
  }, [slug, isPlatformAdmin, org?.id]);

  useEffect(() => {
    if (!targetOrgId) return;
    getOrgUnionCode(targetOrgId)
      .then((data) => {
        setUnionCode(data.union_code ?? "");
        setUnionCodeActive(data.union_code_active !== false);
      })
      .catch(() => {
        setUnionCode("");
        setUnionCodeActive(true);
      });
  }, [targetOrgId]);

  const casesForPeriod = useMemo(() => {
    return allCases.filter((item) => {
      if (!item.createdAt) return false;
      const d = new Date(item.createdAt);
      if (Number.isNaN(d.getTime())) return false;
      return toYearMonth(d) === activeYearMonth;
    });
  }, [allCases, activeYearMonth]);

  const latestCases = useMemo(() => {
    return [...casesForPeriod]
      .sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      })
      .slice(0, 10);
  }, [casesForPeriod]);

  const statusCounts = useMemo(() => metrics?.statusCounts ?? {}, [metrics?.statusCounts]);
  const maxStatusCount = Math.max(1, ...Object.values(statusCounts).map((v) => Number(v || 0)));

  const statusRows = useMemo(() => {
    return Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count: Number(count || 0) }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [statusCounts]);

  const paidCount = Number(metrics?.paidCount || 0);
  const unionBalance = paidCount * UNION_EARNINGS_PER_CASE;
  const accumulatedBalance = history.reduce(
    (sum, row) => sum + Number(row.paidCount || 0) * UNION_EARNINGS_PER_CASE,
    0
  );

  const openErrors = Number(statusCounts.error || 0);
  const pendingSubmit = Number(statusCounts.ready_to_process || 0);
  const awaitingPdf = Number(statusCounts.awaiting_pdf || 0);

  async function handleSaveUnionCode() {
    if (!targetOrgId) {
      setUnionCodeMessage("Nao foi possivel identificar o sindicato para salvar o codigo.");
      return;
    }

    setSavingUnionCode(true);
    setUnionCodeMessage(null);
    try {
      const result = await updateOrgUnionCode(targetOrgId, {
        union_code: unionCode ? unionCode.trim() : null,
        union_code_active: unionCodeActive,
      });
      setUnionCode(result.union_code ?? "");
      setUnionCodeActive(result.union_code_active !== false);
      setUnionCodeMessage("Codigo atualizado com sucesso.");
      appendAudit({
        actor: user?.email || "usuario",
        action: "Atualizacao de codigo",
        detail: `Codigo ${result.union_code_active ? "ativo" : "inativo"}: ${result.union_code || "(vazio)"}`,
      });
    } catch {
      setUnionCodeMessage("Nao foi possivel atualizar o codigo.");
    } finally {
      setSavingUnionCode(false);
    }
  }

  async function handleCopyCode() {
    if (!unionCode) {
      setCopyFeedback("Nao ha codigo para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(unionCode);
      setCopyFeedback("Codigo copiado.");
    } catch {
      setCopyFeedback("Nao foi possivel copiar agora.");
    }
    setTimeout(() => setCopyFeedback(null), 1800);
  }

  function handleGenerateCode() {
    const base = (org?.name || slug || "SINDICATO").toUpperCase().replace(/[^A-Z0-9]/g, "");
    setUnionCode(generateUnionCode(base));
    setCopyFeedback(null);
  }

  const showSkeleton = metricsLoading || casesLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600">Visao geral do periodo {yearMonthLabel(activeYearMonth)}.</p>
          <p className="text-xs text-gray-500">Atualizado em {formatDateTime(updatedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              loadMetrics();
              loadCases();
              loadHistory();
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            Atualizar
          </button>
          <button
            onClick={() => router.push(`/s/${slug}/casos/novo`)}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Novo caso
          </button>
          <button
            onClick={() => router.push(`/s/${slug}/casos?status=ready_to_process`)}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
          >
            Ver pendentes
          </button>
          <button
            onClick={() => router.push(`/s/${slug}/relatorios`)}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700"
          >
            Ver relatorios
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="text-sm font-semibold text-gray-700">Periodo global</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-600">
            Tipo
            <select
              value={periodMode}
              onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
              className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="current">Mes atual</option>
              <option value="previous">Mes anterior</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          {periodMode === "custom" && (
            <label className="text-xs text-gray-600">
              Mes
              <input
                type="month"
                value={customYearMonth}
                onChange={(e) => setCustomYearMonth(e.target.value)}
                className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          <button
            onClick={loadMetrics}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Aplicar periodo
          </button>
        </div>
        {metricsError && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded p-2">{metricsError}</div>}
      </div>

      {(openErrors > 0 || pendingSubmit > 0 || awaitingPdf > 0) && (
        <div className="grid gap-3 md:grid-cols-3">
          {openErrors > 0 && (
            <Link href={`/s/${slug}/casos?status=error`} className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
              <div className="text-sm font-semibold text-red-800">{openErrors} caso(s) com erro</div>
              <div className="text-xs text-red-700">Priorize esses casos para evitar atraso.</div>
            </Link>
          )}
          {pendingSubmit > 0 && (
            <Link href={`/s/${slug}/casos?status=ready_to_process`} className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-sm font-semibold text-amber-800">{pendingSubmit} pronto(s) para envio</div>
              <div className="text-xs text-amber-700">Clique para enviar ao processamento.</div>
            </Link>
          )}
          {awaitingPdf > 0 && (
            <Link href={`/s/${slug}/casos?status=awaiting_pdf`} className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="text-sm font-semibold text-blue-800">{awaitingPdf} aguardando PDF</div>
              <div className="text-xs text-blue-700">Cobrar anexo do PPP dos casos em aberto.</div>
            </Link>
          )}
        </div>
      )}

      {showSkeleton ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-24 rounded-lg bg-white shadow p-4 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs uppercase text-gray-500">Casos criados</div>
            <div className="text-2xl font-semibold text-gray-900">{totalCases(metrics)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs uppercase text-gray-500">Pagos</div>
            <div className="text-2xl font-semibold text-gray-900">{paidCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs uppercase text-gray-500">Saldo do sindicato</div>
            <div className="text-2xl font-semibold text-gray-900">{formatMoney(unionBalance)}</div>
            <div className="text-xs text-gray-500 mt-1">R$ 10,00 por PPP pago</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs uppercase text-gray-500">Concluidos</div>
            <div className="text-2xl font-semibold text-gray-900">{Number(statusCounts.done || 0)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs uppercase text-gray-500">Casos via codigo</div>
            <div className="text-2xl font-semibold text-gray-900">{metrics?.referralCount ?? 0}</div>
            <div className="text-xs mt-2">
              <Link className="text-blue-600 hover:underline" href={`/s/${slug}/casos-via-codigo`}>
                Ver casos
              </Link>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs uppercase text-gray-500">Pagos via codigo</div>
            <div className="text-2xl font-semibold text-gray-900">{metrics?.referralPaidCount ?? 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs uppercase text-gray-500">Acumulado (12 meses)</div>
            <div className="text-2xl font-semibold text-gray-900">
              {historyLoading ? "..." : formatMoney(accumulatedBalance)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Somatorio de repasse por PPP pago</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs uppercase text-gray-500">Estimativa do mes</div>
            <div className="text-2xl font-semibold text-gray-900">{formatMoney(unionBalance)}</div>
            <div className="text-xs text-gray-500 mt-1">Com base no periodo selecionado</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Casos por status</h3>
        {statusRows.length === 0 ? (
          <p className="text-sm text-gray-500">Sem casos no periodo selecionado.</p>
        ) : (
          <div className="space-y-2">
            {statusRows.map((row) => {
              const width = Math.max(8, Math.round((row.count / maxStatusCount) * 100));
              return (
                <button
                  key={row.status}
                  onClick={() => router.push(`/s/${slug}/casos?status=${row.status}`)}
                  className="w-full text-left rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{STATUS_LABELS[row.status] ?? row.status}</span>
                    <span className="text-gray-600">{row.count}</span>
                  </div>
                  <div className="mt-2 h-2 rounded bg-gray-100">
                    <div className="h-2 rounded bg-blue-600" style={{ width: `${width}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Ultimos casos ({yearMonthLabel(activeYearMonth)})</h3>
        {latestCases.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            Nenhum caso encontrado no periodo. Crie um novo caso para iniciar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Caso</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Trabalhador</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Criado</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {latestCases.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{item.id.slice(0, 8)}...</td>
                    <td className="px-3 py-2 text-gray-700">{item.worker?.name || "-"}</td>
                    <td className="px-3 py-2 text-gray-700">{STATUS_LABELS[item.status] ?? item.status}</td>
                    <td className="px-3 py-2 text-gray-700">{formatDateTime(item.createdAt)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/s/${slug}/casos/${item.id}`} className="text-blue-600 hover:underline">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Codigo do sindicato</h3>
        <p className="text-xs text-gray-500">Compartilhe este codigo com trabalhadores para aplicar o desconto.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={unionCode}
            onChange={(event) => setUnionCode(event.target.value)}
            placeholder="Ex: SINDICATO-ABC"
            className="w-full sm:max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={unionCodeActive}
              onChange={(event) => setUnionCodeActive(event.target.checked)}
            />
            Codigo ativo
          </label>
          <button
            onClick={handleSaveUnionCode}
            disabled={savingUnionCode}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {savingUnionCode ? "Salvando..." : "Salvar codigo"}
          </button>
          <button
            onClick={handleCopyCode}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Copiar codigo
          </button>
          <button
            onClick={handleGenerateCode}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Gerar novo
          </button>
        </div>
        {unionCodeMessage && <p className="text-xs text-gray-600">{unionCodeMessage}</p>}
        {copyFeedback && <p className="text-xs text-gray-600">{copyFeedback}</p>}
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Log de acoes</h3>
        {auditLog.length === 0 ? (
          <p className="text-sm text-gray-500">Sem acoes registradas ainda.</p>
        ) : (
          <ul className="space-y-2">
            {auditLog.map((entry) => (
              <li key={entry.id} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-800">{entry.action}</span>
                  <span className="text-xs text-gray-500">{formatDateTime(entry.at)}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{entry.detail}</p>
                <p className="text-xs text-gray-500 mt-1">Por: {entry.actor}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
