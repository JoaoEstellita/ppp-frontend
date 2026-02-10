"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminUsageEvent, getAdminUsage } from "@/src/services/api";
import { Button } from "@/components/Button";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export default function AdminUsagePage() {
  const [events, setEvents] = useState<AdminUsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState("");

  const loadUsage = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUsage({
        type: typeFilter || undefined,
        org_id: orgFilter || undefined,
      });
      setEvents(data);
    } catch (err) {
      console.error("Erro ao carregar eventos de uso:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, orgFilter]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const summary = useMemo(() => {
    const byType = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    return {
      total: events.length,
      uniqueTypes: Object.keys(byType).length,
      topType: topType ? `${topType[0]} (${topType[1]})` : "-",
    };
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Uso</h2>
        <Button onClick={loadUsage} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
          Atualizar
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Eventos totais</div>
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Tipos distintos</div>
          <div className="text-2xl font-bold text-gray-900">{summary.uniqueTypes}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Tipo mais frequente</div>
          <div className="text-sm font-semibold text-gray-900 mt-2">{summary.topType}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo de evento</label>
            <input
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value.trim())}
              placeholder="Ex: case_created"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Org ID</label>
            <input
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value.trim())}
              placeholder="UUID da organização"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={loadUsage} className="bg-blue-600 hover:bg-blue-700 text-white">
              Aplicar filtros
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500">Carregando eventos...</div>
        ) : events.length === 0 ? (
          <div className="p-6 text-gray-500">Sem eventos para os filtros selecionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Criado em</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Org</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Caso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{formatDate(event.created_at)}</td>
                    <td className="px-4 py-2 text-gray-900">{event.type}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">{event.org_id || "-"}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">{event.case_id || "-"}</td>
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

