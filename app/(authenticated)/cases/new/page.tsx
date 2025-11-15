"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useCases } from "@/lib/caseContext";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";

export default function NewCasePage() {
  const router = useRouter();
  const { addCase } = useCases();
  const [formData, setFormData] = useState({
    workerName: "",
    workerCPF: "",
    companyName: "",
    companyCNPJ: "",
    pppFileName: "",
  });

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, pppFileName: file.name }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    addCase({
      ...formData,
      status: "PENDENTE",
    });
    router.push("/cases");
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Novo Caso</h2>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              name="workerName"
              label="Nome do Trabalhador"
              value={formData.workerName}
              onChange={handleInputChange}
              required
            />
            <Input
              name="workerCPF"
              label="CPF"
              value={formData.workerCPF}
              onChange={handleInputChange}
              required
            />
            <Input
              name="companyName"
              label="Nome da Empresa"
              value={formData.companyName}
              onChange={handleInputChange}
              required
            />
            <Input
              name="companyCNPJ"
              label="CNPJ"
              value={formData.companyCNPJ}
              onChange={handleInputChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arquivo PPP
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {formData.pppFileName && (
              <p className="mt-1 text-sm text-gray-600">
                Arquivo selecionado: {formData.pppFileName}
              </p>
            )}
          </div>
          <div className="flex space-x-4">
            <Button type="submit">Salvar</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/cases")}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

