"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  createPublicCase,
  createPublicPayment,
  validateUnionCodePublic,
} from "@/src/services/api";
import { Button } from "@/components/Button";

const BASE_PRICE = 87.9;

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function PublicCaseNewPage() {
  const [workerName, setWorkerName] = useState("");
  const [workerCPF, setWorkerCPF] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyCNPJ, setCompanyCNPJ] = useState("");
  const [unionCode, setUnionCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [price, setPrice] = useState<number>(BASE_PRICE);
  const [normalizedCode, setNormalizedCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [lastCaseId, setLastCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("ppp:last_case_id");
    if (stored) setLastCaseId(stored);
  }, []);

  const handleValidateCode = async () => {
    if (!unionCode.trim()) {
      setNormalizedCode(null);
      setPrice(BASE_PRICE);
      return;
    }
    setLoadingCode(true);
    setError(null);
    try {
      const result = await validateUnionCodePublic(unionCode.trim());
      if (result.valid) {
        setPrice(result.price ?? BASE_PRICE);
        setNormalizedCode(result.normalized_code || unionCode.trim().toUpperCase());
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError("Código inválido ou expirado.");
        } else if (err.status === 400) {
          setError("Código em formato inválido.");
        } else {
          setError(err.message || "Não foi possível validar o código.");
        }
      } else {
        setError("Não foi possível validar o código.");
      }
      setNormalizedCode(null);
      setPrice(BASE_PRICE);
    } finally {
      setLoadingCode(false);
    }
  };

  const handleSubmit = async () => {
    if (!workerName || !workerCPF || !companyName || !companyCNPJ || !file) {
      setError("Preencha todos os campos e anexe o PDF.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createPublicCase({
        workerName,
        workerCPF,
        companyName,
        companyCNPJ,
        unionCode: normalizedCode || unionCode.trim() || undefined,
        file,
      });
      setCaseId(created.case_id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ppp:last_case_id", created.case_id);
        setLastCaseId(created.case_id);
      }

      const payment = await createPublicPayment(created.case_id);
      if (payment?.payment_url) {
        window.location.href = payment.payment_url;
        return;
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 413) {
          setError("Arquivo muito grande. Envie um PDF menor.");
        } else if (err.code === "worker_cpf_conflict") {
          setError("CPF já cadastrado com outro nome. Corrija os dados.");
        } else if (err.status === 409) {
          setError("Pagamento já iniciado para este caso.");
        } else if (err.code === "invalid_union_code") {
          setError("Código inválido ou expirado.");
        } else {
          setError(err.message || "Não foi possível criar o caso.");
        }
      } else {
        setError("Não foi possível criar o caso.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Análise do PPP</h1>
        <p className="text-sm text-gray-600">
          Preencha os dados do trabalhador e envie o PDF do PPP para iniciar a análise.
        </p>
        {lastCaseId && (
          <p className="text-xs text-gray-500">
            Você já iniciou um caso. <Link className="text-blue-600 hover:underline" href={`/ppp/${lastCaseId}`}>Retomar caso</Link>
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs text-gray-600">
            Nome do trabalhador
            <input
              value={workerName}
              onChange={(event) => setWorkerName(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            CPF
            <input
              value={workerCPF}
              onChange={(event) => setWorkerCPF(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            Empresa
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            CNPJ
            <input
              value={companyCNPJ}
              onChange={(event) => setCompanyCNPJ(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="border-t pt-4">
          <label className="text-xs text-gray-600">
            Código do sindicato (opcional)
            <div className="mt-1 flex gap-2">
              <input
                value={unionCode}
                onChange={(event) => setUnionCode(event.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <Button
                onClick={handleValidateCode}
                disabled={loadingCode}
                className="bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                {loadingCode ? "Validando..." : "Aplicar"}
              </Button>
            </div>
          </label>
          {normalizedCode && (
            <p className="text-xs text-green-700 mt-2">Código aplicado: {normalizedCode}</p>
          )}
        </div>

        <div className="border-t pt-4">
          <label className="text-xs text-gray-600">
            PDF do PPP
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-2 text-sm"
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="text-xs text-gray-500">Preço final</p>
            <p className="text-lg font-semibold text-gray-900">{formatPrice(price)}</p>
            {normalizedCode && (
              <div className="mt-1 text-xs text-gray-500">
                <div>Preço padrão: {formatPrice(BASE_PRICE)}</div>
                <div>Desconto aplicado com código do sindicato.</div>
              </div>
            )}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting ? "Criando..." : "Continuar para pagamento"}
          </Button>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {caseId && (
        <div className="text-sm text-gray-600">
          Caso criado. <Link className="text-blue-600 hover:underline" href={`/ppp/${caseId}`}>Acompanhar status</Link>
        </div>
      )}
    </div>
  );
}
