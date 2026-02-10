"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import {
  ApiError,
  PlatformAdmin,
  createPlatformAdmin,
  deletePlatformAdmin,
  listPlatformAdmins,
} from "@/src/services/api";
import { supabaseClient } from "@/lib/supabaseClient";

const PROTECTED_ADMIN_EMAILS = new Set([
  "joaoestellita@conectivos.net",
  "guedes@conectivos.net",
]);

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

export default function AdminPlatformAdminsPage() {
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPlatformAdmins();
      setAdmins(data);
    } catch (err) {
      console.error("Erro ao carregar admins da plataforma:", err);
      setError("Erro ao carregar admins da plataforma.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        setCurrentUserId(user?.id ?? null);
      } catch {
        setCurrentUserId(null);
      }
    })();
  }, []);

  const sortedAdmins = useMemo(
    () => [...admins].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
    [admins]
  );

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setSuccess(null);

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Informe um email válido.");
      return;
    }

    setSubmitting(true);
    try {
      await createPlatformAdmin(normalizedEmail);
      setSuccess("Admin da plataforma adicionado com sucesso.");
      setEmail("");
      await loadAdmins();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "auth_user_not_found") {
          setError("Email não encontrado na base de usuários autenticados.");
        } else if (err.code === "platform_admin_already_exists") {
          setError("Este usuário já é admin da plataforma.");
        } else {
          setError(`Erro ao adicionar admin (${err.code || err.status}).`);
        }
      } else {
        setError("Erro ao adicionar admin da plataforma.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveAdmin(userId: string) {
    setError(null);
    setSuccess(null);
    setRemovingUserId(userId);
    try {
      await deletePlatformAdmin(userId);
      setSuccess("Admin da plataforma removido com sucesso.");
      await loadAdmins();
    } catch (err) {
      if (err instanceof ApiError && err.code === "cannot_remove_self") {
        setError("Você não pode remover seu próprio acesso de admin nesta tela.");
      } else {
        setError("Erro ao remover admin da plataforma.");
      }
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Admins da Plataforma</h2>

      <form onSubmit={handleAddAdmin} className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Adicionar novo admin da plataforma</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email do usuário</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@empresa.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="text-xs text-gray-500">
          O email precisa já existir como usuário autenticado no Supabase.
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}
        {success && <div className="text-sm text-green-600 bg-green-50 p-3 rounded">{success}</div>}
        <Button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {submitting ? "Adicionando..." : "Adicionar admin"}
        </Button>
      </form>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Admins atuais ({sortedAdmins.length})</h3>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-gray-600 flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Carregando...
            </div>
          ) : sortedAdmins.length === 0 ? (
            <div className="text-gray-500 text-center py-6">Nenhum admin da plataforma cadastrado.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">User ID</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Adicionado em</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedAdmins.map((admin) => {
                    const isSelf = currentUserId && admin.user_id === currentUserId;
                    const isProtected = PROTECTED_ADMIN_EMAILS.has((admin.email || "").toLowerCase());
                    return (
                      <tr key={admin.user_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{admin.email || "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 font-mono">{admin.user_id}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(admin.created_at)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleRemoveAdmin(admin.user_id)}
                            disabled={isSelf || isProtected || removingUserId === admin.user_id}
                            className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                            title={
                              isProtected
                                ? "Conta protegida: remoção bloqueada"
                                : isSelf
                                ? "Não é permitido remover seu próprio acesso"
                                : "Remover admin"
                            }
                          >
                            {removingUserId === admin.user_id ? "Removendo..." : "Remover"}
                          </button>
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
    </div>
  );
}
