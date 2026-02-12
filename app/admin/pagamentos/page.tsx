"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminPayment, getAdminPayments } from "@/src/services/api";
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

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value || 0);
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export default function AdminPaymentsPage() {
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState("");

  useEffect(() => {
    const orgId = searchParams?.get("org_id");
    const status = searchParams?.get("status");
    if (orgId) setOrgFilter(orgId);
    if (status) setStatusFilter(status);
  }, [searchParams]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminPayments({
        status: statusFilter || undefined,
        org_id: orgFilter || undefined,
      });
      setPayments(data);
    } catch (err) {
      console.error("Erro ao carregar pagamentos:", err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, orgFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const summary = useMemo(() => {
    const total = payments.length;
    const approved = payments.filter((p) => p.status === "approved");
    const approvedCount = approved.length;
    const approvedAmount = approved.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    return { total, approvedCount, approvedAmount };
  }, [payments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Pagamentos</h2>
        <Button onClick={loadPayments} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
          Atualizar
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Total de pagamentos</div>
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Pagamentos aprovados</div>
          <div className="text-2xl font-bold text-green-700">{summary.approvedCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-xs text-gray-500">Total aprovado</div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(summary.approvedAmount)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="created">created</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="cancelled">cancelled</option>
              <option value="refunded">refunded</option>
            </select>
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
            <Button onClick={loadPayments} className="bg-blue-600 hover:bg-blue-700 text-white">
              Aplicar filtros
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500">Carregando pagamentos...</div>
        ) : payments.length === 0 ? (
          <div className="p-6 text-gray-500">Sem pagamentos para os filtros selecionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Criado em</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Org</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Caso</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Pago em</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-900 font-medium">{formatMoney(item.amount)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">{item.org_id}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">{item.case_id || "-"}</td>
                    <td className="px-4 py-2 text-gray-700">{formatDate(item.paid_at)}</td>
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
