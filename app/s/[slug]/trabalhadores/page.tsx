"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { getWorkers, createWorker, OrgWorker } from "@/src/services/api";
import { Button } from "@/components/Button";

export default function WorkersPage() {
  const PAGE_SIZE = 12;
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
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const data = await getWorkers(slug);
      setWorkers(data);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredWorkers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return workers
      .filter((worker) => {
        if (!normalized) return true;
        const name = (worker.name || "").toLowerCase();
        const cpf = (worker.cpf || "").toLowerCase();
        return name.includes(normalized) || cpf.includes(normalized);
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
  }, [workers, query]);

  const totalPages = Math.max(1, Math.ceil(filteredWorkers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedWorkers = filteredWorkers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query]);

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
    } catch {
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
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou CPF"
            className="w-full sm:max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-sm text-gray-500">{filteredWorkers.length} trabalhador(es)</span>
        </div>
        {loading ? (
          <div className="text-gray-600">Carregando...</div>
        ) : (
          <div className="space-y-2 text-sm text-gray-700">
            {pagedWorkers.map((worker) => (
              <div key={worker.id} className="flex justify-between border-b last:border-b-0 py-2">
                <div>
                  <div className="font-semibold">{worker.name}</div>
                  <div className="text-xs text-gray-500">{worker.cpf || "-"}</div>
                </div>
                <div className="text-xs text-gray-500">{worker.birth_date || "-"}</div>
              </div>
            ))}
            {filteredWorkers.length === 0 && (
              <div className="text-gray-500">Nenhum trabalhador cadastrado.</div>
            )}
            {filteredWorkers.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-500">
                  Página {currentPage} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
