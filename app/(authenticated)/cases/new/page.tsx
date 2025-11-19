"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createCase } from "@/src/services/api";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.workerName.trim()) {
      setError("Nome do trabalhador eh obrigatorio.");
      return false;
    }
    if (!formData.workerCPF.trim()) {
      setError("CPF eh obrigatorio.");
      return false;
    }
    if (!formData.companyName.trim()) {
      setError("Nome da empresa eh obrigatorio.");
      return false;
    }
    if (!formData.companyCNPJ.trim()) {
      setError("CNPJ eh obrigatorio.");
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

      await createCase({
        workerName: formData.workerName.trim(),
        workerCPF: formData.workerCPF.trim(),
        companyName: formData.companyName.trim(),
        companyCNPJ: formData.companyCNPJ.trim(),
      });

      router.push("/cases");
    } catch (err) {
      console.error(err);
      setError("Nao foi possivel criar o caso. Tente novamente.");
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
