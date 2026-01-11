"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/Button";
import {
  createOrganization,
  getOrganizations,
  Organization,
  createBulkOrgInvites,
  listOrgInvites,
  revokeOrgInvite,
  OrgInvite,
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

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", emails: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Estado para modal de convites
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [newEmails, setNewEmails] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrganizations();
      setOrgs(data);
    } catch (err) {
      console.error("Erro ao carregar organizações:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim() || !form.slug.trim()) {
      setError("Nome e slug são obrigatórios.");
      return;
    }

    setCreating(true);

    try {
      // Criar organização com um user_id placeholder
      const org = await createOrganization({
        name: form.name.trim(),
        slug: form.slug.trim(),
        user_id: "00000000-0000-0000-0000-000000000000",
      });

      // Se tem emails, criar convites
      const emailList = form.emails
        .split(/[,;\n]/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && e.includes("@"));

      if (emailList.length > 0) {
        await createBulkOrgInvites(org.id, emailList);
        setSuccess(`Sindicato "${org.name}" criado e ${emailList.length} convite(s) enviado(s)!`);
      } else {
        setSuccess(`Sindicato "${org.name}" criado com sucesso!`);
      }

      setForm({ name: "", slug: "", emails: "" });
      await loadOrgs();
    } catch (err) {
      setError("Não foi possível criar organização.");
    } finally {
      setCreating(false);
    }
  }

  async function openInviteModal(org: Organization) {
    setSelectedOrg(org);
    setInvites([]);
    setNewEmails("");
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLoading(true);

    try {
      const data = await listOrgInvites(org.id);
      setInvites(data);
    } catch (err) {
      console.error("Erro ao carregar convites:", err);
      setInviteError("Erro ao carregar convites.");
      setInvites([]);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleSendInvites() {
    if (!selectedOrg) return;

    const emailList = newEmails
      .split(/[,;\n]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes("@"));

    if (emailList.length === 0) {
      setInviteError("Informe pelo menos um email válido.");
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const result = await createBulkOrgInvites(selectedOrg.id, emailList);
      const created = result.results?.filter((r) => r.status === "created").length ?? 0;
      const skipped = result.results?.filter((r) => r.status === "skipped").length ?? 0;

      if (created > 0) {
        setInviteSuccess(`${created} convite(s) criado(s)${skipped > 0 ? `, ${skipped} já existia(m)` : ""}.`);
      } else if (skipped > 0) {
        setInviteError(`Todos os ${skipped} email(s) já estavam convidados.`);
      }

      setNewEmails("");
      const data = await listOrgInvites(selectedOrg.id);
      setInvites(data);
    } catch (err) {
      console.error("Erro ao enviar convites:", err);
      setInviteError("Erro ao enviar convites. Verifique se você tem permissão.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!selectedOrg) return;

    setRevokingId(inviteId);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      await revokeOrgInvite(selectedOrg.id, inviteId);
      setInviteSuccess("Convite revogado com sucesso.");

      // Recarregar lista
      const data = await listOrgInvites(selectedOrg.id);
      setInvites(data);
    } catch (err) {
      console.error("Erro ao revogar convite:", err);
      setInviteError("Erro ao revogar convite.");
    } finally {
      setRevokingId(null);
    }
  }

  function closeModal() {
    setSelectedOrg(null);
    setInvites([]);
    setNewEmails("");
    setInviteError(null);
    setInviteSuccess(null);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Sindicatos</h2>

      {/* Formulário de criação */}
      <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Criar novo sindicato</h3>

        {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}
        {success && <div className="text-sm text-green-600 bg-green-50 p-3 rounded">{success}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do sindicato</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Sindicato dos Metalúrgicos"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
              placeholder="Ex: sindicato-metalurgicos"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Emails para convite (opcional)
          </label>
          <textarea
            value={form.emails}
            onChange={(e) => setForm({ ...form, emails: e.target.value })}
            placeholder="usuario1@email.com, usuario2@email.com"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Separe os emails por vírgula, ponto e vírgula ou linha. Os usuários receberão acesso automático ao fazer login.
          </p>
        </div>

        <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white">
          {creating ? "Criando..." : "Criar sindicato"}
        </Button>
      </form>

      {/* Lista de sindicatos */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Sindicatos cadastrados</h3>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-gray-600 flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Carregando...
            </div>
          ) : (
            <div className="space-y-2">
              {orgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between border-b last:border-b-0 py-3"
                >
                  <div>
                    <div className="font-semibold text-gray-900">{org.name}</div>
                    <div className="text-xs text-gray-500">/{org.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        org.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {org.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => openInviteModal(org)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                    >
                      Convites
                    </button>
                  </div>
                </div>
              ))}
              {orgs.length === 0 && (
                <div className="text-gray-500 text-center py-4">Nenhum sindicato cadastrado.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Convites */}
      {selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Gerenciar Convites</h3>
                <p className="text-sm text-gray-500">{selectedOrg.name}</p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Mensagens de feedback */}
              {inviteError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {inviteSuccess}
                </div>
              )}

              {/* Adicionar convites */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Enviar novos convites
                </label>
                <textarea
                  value={newEmails}
                  onChange={(e) => setNewEmails(e.target.value)}
                  placeholder="email1@exemplo.com, email2@exemplo.com"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500">
                  Separe os emails por vírgula, ponto e vírgula ou quebra de linha.
                </p>
                <Button
                  onClick={handleSendInvites}
                  disabled={inviteLoading || !newEmails.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviteLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    "Enviar convites"
                  )}
                </Button>
              </div>

              {/* Lista de convites */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Convites ({invites.length})
                </h4>

                {inviteLoading && invites.length === 0 ? (
                  <div className="text-gray-500 text-sm flex items-center gap-2 py-4">
                    <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Carregando convites...
                  </div>
                ) : invites.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-8 bg-gray-50 rounded-lg">
                    Nenhum convite enviado ainda.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Criado em</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {invites.map((invite) => (
                          <tr key={invite.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-900">{invite.email}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center text-xs px-2 py-1 rounded-full font-medium ${
                                  invite.status === "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : invite.status === "accepted"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {invite.status === "pending"
                                  ? "Pendente"
                                  : invite.status === "accepted"
                                  ? "Aceito"
                                  : "Revogado"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">
                              {formatDate(invite.created_at)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {invite.status === "pending" && (
                                <button
                                  onClick={() => handleRevokeInvite(invite.id)}
                                  disabled={revokingId === invite.id}
                                  className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                >
                                  {revokingId === invite.id ? "Revogando..." : "Revogar"}
                                </button>
                              )}
                              {invite.status === "accepted" && (
                                <span className="text-xs text-gray-400">
                                  Aceito em {formatDate(invite.accepted_at)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 shrink-0">
              <Button
                onClick={closeModal}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
