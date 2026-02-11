"use client";

import Link from "next/link";
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
  OrgMember,
  listOrgMembers,
  removeOrgMember,
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

function roleLabel(member: OrgMember): string {
  if (member.is_platform_admin) return "Admin da plataforma";
  if (member.role === "org_admin") return "Admin do sindicato";
  return "Membro";
}

const PROTECTED_ADMIN_EMAILS = new Set([
  "joaoestellita@conectivos.net",
  "guedes@conectivos.net",
]);

function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return PROTECTED_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", emails: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [newEmails, setNewEmails] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

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

  async function reloadInviteModal(orgId: string) {
    const [invitesData, membersData] = await Promise.all([
      listOrgInvites(orgId),
      listOrgMembers(orgId),
    ]);
    setInvites(invitesData);
    setMembers(membersData);
  }

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
      const org = await createOrganization({
        name: form.name.trim(),
        slug: form.slug.trim(),
        user_id: "00000000-0000-0000-0000-000000000000",
      });

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
    setMembers([]);
    setNewEmails("");
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLoading(true);
    setMembersLoading(true);

    try {
      await reloadInviteModal(org.id);
    } catch (err) {
      console.error("Erro ao carregar dados de acesso:", err);
      setInviteError("Erro ao carregar convites e membros.");
      setInvites([]);
      setMembers([]);
    } finally {
      setInviteLoading(false);
      setMembersLoading(false);
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
      const failed = result.results?.filter((r) => r.status === "failed").length ?? 0;
      const emailFailures =
        result.results?.filter((r) => r.status === "created" && r.email_sent === false).length ?? 0;

      if (created > 0) {
        const parts = [`${created} convite(s) criado(s)`];
        if (skipped > 0) parts.push(`${skipped} já existia(m)`);
        if (failed > 0) parts.push(`${failed} falhou/falharam na criação`);
        if (emailFailures > 0) parts.push(`${emailFailures} com falha no envio de email`);
        setInviteSuccess(`${parts.join(", ")}.`);
      } else if (skipped > 0) {
        setInviteError(`Todos os ${skipped} email(s) já estavam convidados.`);
      } else if (failed > 0) {
        setInviteError("Não foi possível criar os convites informados.");
      }

      setNewEmails("");
      await reloadInviteModal(selectedOrg.id);
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
      await reloadInviteModal(selectedOrg.id);
    } catch (err) {
      console.error("Erro ao revogar convite:", err);
      setInviteError("Erro ao revogar convite.");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRemoveMember(member: OrgMember) {
    if (!selectedOrg) return;

    setRemovingMemberId(member.id);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      await removeOrgMember(selectedOrg.id, member.id);
      setInviteSuccess("Membro removido do sindicato com sucesso.");
      await reloadInviteModal(selectedOrg.id);
    } catch (err) {
      console.error("Erro ao remover membro:", err);
      setInviteError("Erro ao remover membro do sindicato.");
    } finally {
      setRemovingMemberId(null);
    }
  }

  function closeModal() {
    setSelectedOrg(null);
    setInvites([]);
    setMembers([]);
    setNewEmails("");
    setInviteError(null);
    setInviteSuccess(null);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Sindicatos</h2>

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
              onChange={(e) =>
                setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
              }
              placeholder="Ex: sindicato-metalurgicos"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emails para convite (opcional)</label>
          <textarea
            value={form.emails}
            onChange={(e) => setForm({ ...form, emails: e.target.value })}
            placeholder="usuario1@email.com, usuario2@email.com"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Separe os emails por vírgula, ponto e vírgula ou linha.
          </p>
        </div>

        <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white">
          {creating ? "Criando..." : "Criar sindicato"}
        </Button>
      </form>

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
                <div key={org.id} className="flex items-center justify-between border-b last:border-b-0 py-3">
                  <div>
                    <div className="font-semibold text-gray-900">{org.name}</div>
                    <div className="text-xs text-gray-500">/{org.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        org.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {org.status}
                    </span>
                    <Link
                      href={`/s/${org.slug}/dashboard`}
                      className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Acessar
                    </Link>
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

      {selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Gerenciar Convites e Membros</h3>
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

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {inviteError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {inviteSuccess}
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">Enviar novos convites</label>
                <textarea
                  value={newEmails}
                  onChange={(e) => setNewEmails(e.target.value)}
                  placeholder="email1@exemplo.com, email2@exemplo.com"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500">Separe os emails por vírgula, ponto e vírgula ou quebra de linha.</p>
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

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Convites ({invites.length})</h4>

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
                        {invites.map((invite) => {
                          const isProtectedInvite = isProtectedAdminEmail(invite.email);
                          const acceptedMember =
                            invite.status === "accepted"
                              ? members.find(
                                  (member) => (member.email || "").toLowerCase() === invite.email.toLowerCase()
                                )
                              : null;

                          return (
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
                              <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(invite.created_at)}</td>
                              <td className="px-3 py-2 text-right">
                                {invite.status === "pending" && (
                                  <button
                                    onClick={() => handleRevokeInvite(invite.id)}
                                    disabled={isProtectedInvite || revokingId === invite.id}
                                    className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                    title={isProtectedInvite ? "Conta protegida: revogação bloqueada" : "Revogar convite"}
                                  >
                                    {revokingId === invite.id ? "Revogando..." : "Revogar"}
                                  </button>
                                )}

                                {invite.status === "accepted" && (
                                  <div className="flex items-center justify-end gap-2">
                                    <span className="text-xs text-gray-400">Aceito em {formatDate(invite.accepted_at)}</span>
                                    {acceptedMember && (
                                      <button
                                        onClick={() => handleRemoveMember(acceptedMember)}
                                        disabled={
                                          isProtectedAdminEmail(acceptedMember.email) ||
                                          removingMemberId === acceptedMember.id
                                        }
                                        className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                        title={
                                          isProtectedAdminEmail(acceptedMember.email)
                                            ? "Conta protegida: remoção bloqueada"
                                            : "Remover acesso"
                                        }
                                      >
                                        {removingMemberId === acceptedMember.id ? "Removendo..." : "Remover acesso"}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Membros atuais ({members.length})</h4>

                {membersLoading ? (
                  <div className="text-gray-500 text-sm flex items-center gap-2 py-4">
                    <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Carregando membros...
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-8 bg-gray-50 rounded-lg">
                    Nenhum membro ativo neste sindicato.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Perfil</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Entrou em</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {members.map((member) => (
                          <tr key={member.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-900">{member.email || "-"}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center text-xs px-2 py-1 rounded-full font-medium ${
                                  member.is_platform_admin
                                    ? "bg-purple-100 text-purple-700"
                                    : member.role === "org_admin"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {roleLabel(member)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{formatDate(member.created_at)}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleRemoveMember(member)}
                                disabled={isProtectedAdminEmail(member.email) || removingMemberId === member.id}
                                className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                title={isProtectedAdminEmail(member.email) ? "Conta protegida: remoção bloqueada" : "Remover"}
                              >
                                {removingMemberId === member.id ? "Removendo..." : "Remover"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 shrink-0">
              <Button onClick={closeModal} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





