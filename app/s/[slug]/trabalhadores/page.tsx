"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getWorkers, createWorker, OrgWorker } from "@/src/services/api";
import { Button } from "@/components/Button";

export default function WorkersPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [workers, setWorkers] = useState<OrgWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", cpf: "", birth_date: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!slug) return;
    setLoading(true);
    try {
      const data = await getWorkers(slug);
      setWorkers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [slug]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Nome do trabalhador e obrigatorio.");
      return;
    }
    try {
      await createWorker(slug, {
        name: form.name.trim(),
        cpf: form.cpf.trim() || undefined,
        birth_date: form.birth_date || undefined,
      });
      setForm({ name: "", cpf: "", birth_date: "" });
      await load();
    } catch (err) {
      setError("Nao foi possivel criar trabalhador.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Trabalhadores</h2>
        <p className="text-sm text-gray-600">Cadastro dos trabalhadores do sindicato.</p>
      </div>

      <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-4 space-y-3">
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="grid md:grid-cols-3 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <input
            value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: e.target.value })}
            placeholder="CPF"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <input
            value={form.birth_date}
            onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            placeholder="Nascimento (YYYY-MM-DD)"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <Button type="submit">Adicionar trabalhador</Button>
      </form>

      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <div className="text-gray-600">Carregando...</div>
        ) : (
          <div className="space-y-2 text-sm text-gray-700">
            {workers.map((worker) => (
              <div key={worker.id} className="flex justify-between border-b last:border-b-0 py-2">
                <div>
                  <div className="font-semibold">{worker.name}</div>
                  <div className="text-xs text-gray-500">{worker.cpf || "-"}</div>
                </div>
                <div className="text-xs text-gray-500">{worker.birth_date || "-"}</div>
              </div>
            ))}
            {workers.length === 0 && (
              <div className="text-gray-500">Nenhum trabalhador cadastrado.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

