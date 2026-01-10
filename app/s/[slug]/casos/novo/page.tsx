"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { createCase } from "@/src/services/api";

export default function NewCasePage() {
  const router = useRouter();
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";
  const [formData, setFormData] = useState({
    workerName: "",
    workerCPF: "",
    companyName: "",
    companyCNPJ: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.workerName.trim()) {
      setError("Nome do trabalhador e obrigatorio.");
      return;
    }
    if (!formData.workerCPF.trim()) {
      setError("CPF do trabalhador e obrigatorio.");
      return;
    }
    if (!formData.companyName.trim()) {
      setError("Nome da empresa e obrigatorio.");
      return;
    }
    if (!formData.companyCNPJ.trim()) {
      setError("CNPJ da empresa e obrigatorio.");
      return;
    }

    try {
      setLoading(true);
      await createCase(slug, {
        workerName: formData.workerName.trim(),
        workerCPF: formData.workerCPF.trim(),
        companyName: formData.companyName.trim(),
        companyCNPJ: formData.companyCNPJ.trim(),
      });
      router.push(`/s/${slug}/casos`);
    } catch (err) {
      console.error(err);
      setError("Nao foi possivel criar o caso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Novo caso</h2>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-red-600">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome do trabalhador</label>
          <input
            name="workerName"
            value={formData.workerName}
            onChange={(e) => setFormData({ ...formData, workerName: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">CPF do trabalhador</label>
          <input
            name="workerCPF"
            value={formData.workerCPF}
            onChange={(e) => setFormData({ ...formData, workerCPF: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Empresa</label>
          <input
            name="companyName"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">CNPJ da empresa</label>
          <input
            name="companyCNPJ"
            value={formData.companyCNPJ}
            onChange={(e) => setFormData({ ...formData, companyCNPJ: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Criando..." : "Criar caso"}
          </Button>
          <Button variant="outline" type="button" onClick={() => router.push(`/s/${slug}/casos`)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

