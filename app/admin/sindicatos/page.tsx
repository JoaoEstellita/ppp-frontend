"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { createOrganization, getOrganizations, Organization } from "@/src/services/api";

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", user_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!form.name.trim() || !form.slug.trim() || !form.user_id.trim()) {
      setError("Nome, slug e user_id sao obrigatorios.");
      return;
    }
    try {
      await createOrganization({
        name: form.name.trim(),
        slug: form.slug.trim(),
        user_id: form.user_id.trim(),
      });
      setForm({ name: "", slug: "", user_id: "" });
      await load();
    } catch (err) {
      setError("Nao foi possivel criar organizacao.");
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Sindicatos</h2>

      <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-4 space-y-3">
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="grid md:grid-cols-3 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome do sindicato"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="Slug"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <input
            value={form.user_id}
            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
            placeholder="User ID (Supabase)"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <Button type="submit">Criar sindicato</Button>
      </form>

      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <div className="text-gray-600">Carregando...</div>
        ) : (
          <div className="space-y-2 text-sm text-gray-700">
            {orgs.map((org) => (
              <div key={org.id} className="flex justify-between border-b last:border-b-0 py-2">
                <div>
                  <div className="font-semibold">{org.name}</div>
                  <div className="text-xs text-gray-500">{org.slug}</div>
                </div>
                <div className="text-xs text-gray-500">{org.status}</div>
              </div>
            ))}
            {orgs.length === 0 && (
              <div className="text-gray-500">Nenhuma organizacao cadastrada.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

