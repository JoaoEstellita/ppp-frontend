"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createCase, uploadPPP } from "@/src/services/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";

export default function NewCasePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    workerName: "",
    workerCPF: "",
    companyName: "",
    companyCNPJ: "",
  });
  const [pppFile, setPppFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPppFile(file || null);
  };

  const validateForm = (): boolean => {
    if (!formData.workerName.trim()) {
      setError("Nome do trabalhador é obrigatório.");
      return false;
    }
    if (!formData.workerCPF.trim()) {
      setError("CPF é obrigatório.");
      return false;
    }
    if (!formData.companyName.trim()) {
      setError("Nome da empresa é obrigatório.");
      return false;
    }
    if (!formData.companyCNPJ.trim()) {
      setError("CNPJ é obrigatório.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Criar o caso
      const newCase = await createCase({
        workerName: formData.workerName.trim(),
        workerCPF: formData.workerCPF.trim(),
        companyName: formData.companyName.trim(),
        companyCNPJ: formData.companyCNPJ.trim(),
      });

      // Se houver arquivo PPP, fazer upload
      if (pppFile) {
        await uploadPPP(newCase.id, pppFile);
      }

      // Redirecionar para a lista de casos
      router.push("/cases");
    } catch (err) {
      setError("Não foi possível criar o caso. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Novo Caso</h2>
      <Card>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              name="workerName"
              label="Nome do Trabalhador"
              value={formData.workerName}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
            <Input
              name="workerCPF"
              label="CPF"
              value={formData.workerCPF}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
            <Input
              name="companyName"
              label="Nome da Empresa"
              value={formData.companyName}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
            <Input
              name="companyCNPJ"
              label="CNPJ"
              value={formData.companyCNPJ}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arquivo PPP (opcional)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {pppFile && (
              <p className="mt-1 text-sm text-gray-600">
                Arquivo selecionado: {pppFile.name}
              </p>
            )}
          </div>
          <div className="flex space-x-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/cases")}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

