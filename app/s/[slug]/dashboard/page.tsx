"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getOrgMetrics, getOrgUnionCode, updateOrgUnionCode, OrgMetrics } from "@/src/services/api";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";

export default function OrgDashboardPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";
  const [metrics, setMetrics] = useState<OrgMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { org } = useOrgAccess();
  const [unionCode, setUnionCode] = useState<string>("");
  const [unionCodeActive, setUnionCodeActive] = useState(true);
  const [unionCodeMessage, setUnionCodeMessage] = useState<string | null>(null);
  const [savingUnionCode, setSavingUnionCode] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    getOrgMetrics(slug)
      .then((data) => {
        if (active) setMetrics(data);
      })
      .catch(() => {
        if (active) setMetrics(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!org?.id) return;
    let active = true;
    getOrgUnionCode(org.id)
      .then((data) => {
        if (!active) return;
        setUnionCode(data.union_code ?? "");
        setUnionCodeActive(data.union_code_active !== false);
      })
      .catch(() => {
        if (!active) return;
        setUnionCode("");
        setUnionCodeActive(true);
      });
    return () => {
      active = false;
    };
  }, [org?.id]);

  async function handleSaveUnionCode() {
    if (!org?.id) return;
    setSavingUnionCode(true);
    setUnionCodeMessage(null);
    try {
      const result = await updateOrgUnionCode(org.id, {
        union_code: unionCode ? unionCode.trim() : null,
        union_code_active: unionCodeActive,
      });
      setUnionCode(result.union_code ?? "");
      setUnionCodeActive(result.union_code_active !== false);
      setUnionCodeMessage("Codigo atualizado com sucesso.");
    } catch {
      setUnionCodeMessage("Nao foi possivel atualizar o codigo.");
    } finally {
      setSavingUnionCode(false);
    }
  }

  if (loading) {
    return <div className="text-gray-600">Carregando dashboard...</div>;
  }

  if (!metrics) {
    return <div className="text-gray-600">Sem dados de uso no momento.</div>;
  }

  const statusCounts = metrics.statusCounts || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-600">Visao geral do mes {metrics.year_month}.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs uppercase text-gray-500">Casos criados</div>
          <div className="text-2xl font-semibold text-gray-900">
            {Object.values(statusCounts).reduce((sum, value) => sum + value, 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs uppercase text-gray-500">Pagos</div>
          <div className="text-2xl font-semibold text-gray-900">{metrics.paidCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs uppercase text-gray-500">Receita bruta</div>
          <div className="text-2xl font-semibold text-gray-900">
            R$ {metrics.grossAmount.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs uppercase text-gray-500">Concluidos</div>
          <div className="text-2xl font-semibold text-gray-900">
            {statusCounts.done ?? 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs uppercase text-gray-500">Casos via código</div>
          <div className="text-2xl font-semibold text-gray-900">
            {metrics.referralCount ?? 0}
          </div>
          <div className="text-xs mt-2">
            <Link className="text-blue-600 hover:underline" href={`/s/${slug}/casos-via-codigo`}>
              Ver casos
            </Link>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs uppercase text-gray-500">Pagos via código</div>
          <div className="text-2xl font-semibold text-gray-900">
            {metrics.referralPaidCount ?? 0}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Casos por status</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between bg-gray-50 rounded-md p-3">
              <span className="text-gray-600">{status}</span>
              <span className="font-semibold text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Codigo do sindicato</h3>
        <p className="text-xs text-gray-500">
          Compartilhe este codigo com trabalhadores para aplicar o desconto.
        </p>
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
        </div>
        {unionCodeMessage && (
          <p className="text-xs text-gray-600">{unionCodeMessage}</p>
        )}
      </div>
    </div>
  );
}
