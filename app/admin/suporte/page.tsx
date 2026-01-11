"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import {
  adminListSupportCases,
  adminRetryCase,
  adminRetryBulk,
  adminResolveSupport,
  SupportCaseItem,
} from "@/src/services/api";

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

export default function AdminSupportPage() {
  const [cases, setCases] = useState<SupportCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "error" | "processing">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminListSupportCases(filter);
      setCases(data);
    } catch (err) {
      console.error("Erro ao carregar casos:", err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleRetry = async (caseId: string) => {
    setActionLoading(`retry-${caseId}`);
    setMessage(null);
    try {
      const result = await adminRetryCase(caseId);
      setMessage({ 
        type: "success", 
        text: `${result.message} O caso foi movido para status "processing" e pode sair desta lista.`
      });
      await loadCases();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao reprocessar." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (requestId: string) => {
    setActionLoading(`resolve-${requestId}`);
    setMessage(null);
    try {
      const result = await adminResolveSupport(requestId);
      setMessage({ type: "success", text: result.message });
      await loadCases();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao resolver." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkRetry = async () => {
    setBulkLoading(true);
    setMessage(null);
    try {
      const result = await adminRetryBulk({ status: "error", limit: 20 });
      setMessage({ 
        type: "success", 
        text: `${result.message} Processados: ${result.processed}, Ignorados: ${result.skipped}.`
      });
      setShowBulkModal(false);
      await loadCases();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erro ao reprocessar em lote." });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Casos com Erro / Suporte</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "open" | "error" | "processing")}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="all">Todos com erro</option>
            <option value="error">Somente status erro</option>
            <option value="open">Com solicitação aberta</option>
            <option value="processing">Em processamento</option>
          </select>
          <Button
            onClick={loadCases}
            disabled={loading}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Atualizar
          </Button>
          <Button
            onClick={() => setShowBulkModal(true)}
            disabled={loading || cases.length === 0}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Reprocessar todos com erro
          </Button>
        </div>
      </div>

      {/* Modal de confirmação bulk */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Reprocessar todos com erro?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Isso irá reprocessar até 20 casos com status &quot;erro&quot; de uma vez.
              Os casos serão movidos para status &quot;processing&quot;.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setShowBulkModal(false)}
                disabled={bulkLoading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkRetry}
                disabled={bulkLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {bulkLoading ? "Processando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mensagem de feedback */}
      {message && (
        <div className={`p-3 rounded text-sm ${
          message.type === "success"
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      {/* Lista de casos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <span className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-2">Carregando casos...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Nenhum caso com erro no momento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Caso</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Sindicato</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Trabalhador</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Erro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Retries</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Suporte</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cases.map((item) => (
                  <tr key={item.case_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/casos/${item.case_id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {item.case_id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.org_name ?? "-"}</div>
                      <div className="text-xs text-gray-500">/{item.org_slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{item.worker_name ?? "-"}</div>
                      <div className="text-xs text-gray-500">{item.worker_cpf ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {item.last_error_message ? (
                        <div className="text-red-600 text-xs truncate" title={item.last_error_message}>
                          {item.last_error_message}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      {item.last_error_step && (
                        <div className="text-xs text-gray-400 mt-1">
                          Etapa: {item.last_error_step}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                        item.retry_count >= 3
                          ? "bg-red-100 text-red-700"
                          : item.retry_count > 0
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {item.retry_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.support_request ? (
                        <div>
                          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                            Solicitado
                          </span>
                          {item.support_request.message && (
                            <div className="text-xs text-gray-500 mt-1 truncate max-w-32" title={item.support_request.message}>
                              &quot;{item.support_request.message}&quot;
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRetry(item.case_id)}
                          disabled={actionLoading === `retry-${item.case_id}`}
                          className="px-3 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === `retry-${item.case_id}` ? "..." : "Reprocessar"}
                        </button>
                        {item.support_request && (
                          <button
                            onClick={() => handleResolve(item.support_request!.id)}
                            disabled={actionLoading === `resolve-${item.support_request!.id}`}
                            className="px-3 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === `resolve-${item.support_request!.id}` ? "..." : "Resolver"}
                          </button>
                        )}
                      </div>
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
