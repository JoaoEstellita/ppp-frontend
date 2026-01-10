"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getOrgMetrics, OrgMetrics } from "@/src/services/api";

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
    </div>
  );
}

