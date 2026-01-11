"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import {
  createOrganization,
  getOrganizations,
  Organization,
  createBulkOrgInvites,
  listOrgInvites,
  OrgInvite,
} from "@/src/services/api";

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

  async function load() {
    setLoading(true);
    const data = await getOrganizations();
    setOrgs(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
      // Criar organização com um user_id placeholder (será substituído pelo convite)
      const org = await createOrganization({
        name: form.name.trim(),
        slug: form.slug.trim(),
        user_id: "00000000-0000-0000-0000-000000000000", // Placeholder - usuário será adicionado via convite
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
      await load();
    } catch (err) {
      setError("Não foi possível criar organização.");
    } finally {
      setCreating(false);
    }
  }

  async function openInviteModal(org: Organization) {
    setSelectedOrg(org);
    setInviteLoading(true);
    try {
      const data = await listOrgInvites(org.id);
      setInvites(data);
    } catch {
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

    if (emailList.length === 0) return;

    setInviteLoading(true);
    try {
      await createBulkOrgInvites(selectedOrg.id, emailList);
      setNewEmails("");
      const data = await listOrgInvites(selectedOrg.id);
      setInvites(data);
    } catch {
      // Erro silencioso
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Sindicatos</h2>

      <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Criar novo sindicato</h3>

        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        {success && <div className="text-sm text-green-600 bg-green-50 p-2 rounded">{success}</div>}

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

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Sindicatos cadastrados</h3>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-gray-600">Carregando...</div>
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
                    <Button
                      onClick={() => openInviteModal(org)}
                      className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      Convites
                    </Button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Convites - {selectedOrg.name}
              </h3>
              <button
                onClick={() => setSelectedOrg(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Adicionar convites */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Adicionar emails
                </label>
                <textarea
                  value={newEmails}
                  onChange={(e) => setNewEmails(e.target.value)}
                  placeholder="email1@exemplo.com, email2@exemplo.com"
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <Button
                  onClick={handleSendInvites}
                  disabled={inviteLoading || !newEmails.trim()}
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {inviteLoading ? "Enviando..." : "Enviar convites"}
                </Button>
              </div>

              {/* Lista de convites */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Convites enviados</h4>
                {inviteLoading ? (
                  <div className="text-gray-500 text-sm">Carregando...</div>
                ) : invites.length === 0 ? (
                  <div className="text-gray-500 text-sm">Nenhum convite ainda.</div>
                ) : (
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between text-sm bg-gray-50 rounded p-2"
                      >
                        <span className="text-gray-700">{invite.email}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200">
              <Button
                onClick={() => setSelectedOrg(null)}
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
