"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  createPublicCase,
  createPublicPayment,
  validateUnionCodePublic,
} from "@/src/services/api";
import { Button } from "@/components/Button";

const BASE_PRICE = 87.9;
const DISCOUNT_PRICE = 67.9;
const MAX_PDF_MB = 5;

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return "";
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 9);
  const p4 = digits.slice(9, 11);
  return `${p1}.${p2}.${p3}-${p4}`.replace(/[-.]$/, "");
}

function formatCnpj(value: string) {
  const digits = digitsOnly(value).slice(0, 14);
  if (!digits) return "";
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 5);
  const p3 = digits.slice(5, 8);
  const p4 = digits.slice(8, 12);
  const p5 = digits.slice(12, 14);
  return `${p1}.${p2}.${p3}/${p4}-${p5}`.replace(/[-./]$/, "");
}

function isValidEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

type CodeState = "idle" | "validating" | "valid" | "invalid";

function mapCreateCaseErrorMessage(err: ApiError): string | null {
  const detailsMessage =
    typeof err.details === "object" && err.details !== null
      ? (err.details as any).message || (err.details as any).error
      : null;
  const rawMessage = String(detailsMessage || err.message || "").toLowerCase();
  const rawCode = String(err.code || "").toLowerCase();

  if (rawCode === "platform_org_not_found" || rawMessage.includes("platform_org_not_found")) {
    return "Configuracao interna da plataforma ausente. Avise o suporte para regularizar o cadastro da organizacao e tente novamente.";
  }

  return detailsMessage || err.message || null;
}

export default function PublicCaseNewPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [workerName, setWorkerName] = useState("");
  const [workerCPF, setWorkerCPF] = useState("");
  const [workerEmail, setWorkerEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyCNPJ, setCompanyCNPJ] = useState("");
  const [unionCodeInput, setUnionCodeInput] = useState("");
  const [normalizedCode, setNormalizedCode] = useState<string | null>(null);
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slowSubmit, setSlowSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [lastCaseId, setLastCaseId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);

  const finalPrice = normalizedCode ? DISCOUNT_PRICE : BASE_PRICE;
  const discountAmount = BASE_PRICE - finalPrice;

  const workerNameValid = workerName.trim().length > 0;
  const workerCpfValid = digitsOnly(workerCPF).length === 11;
  const workerEmailValid = isValidEmail(workerEmail);
  const companyNameValid = companyName.trim().length > 0;
  const companyCnpjValid = digitsOnly(companyCNPJ).length === 14;
  const hasFile = Boolean(selectedFile);
  const fileWithinLimit = !selectedFile || selectedFile.size <= MAX_PDF_MB * 1024 * 1024;
  const codeTyped = unionCodeInput.trim().length > 0;
  const codeReady = !codeTyped || Boolean(normalizedCode);

  const canContinue =
    workerNameValid &&
    workerCpfValid &&
    workerEmailValid &&
    companyNameValid &&
    companyCnpjValid &&
    hasFile &&
    fileWithinLimit &&
    codeReady &&
    lgpdAccepted &&
    !submitting;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedCaseId = window.localStorage.getItem("ppp:last_case_id");
    if (storedCaseId) {
      setLastCaseId(storedCaseId);
    }
  }, []);

  useEffect(() => {
    const hasData = Boolean(workerName || workerCPF || workerEmail || companyName || companyCNPJ);
    if (!hasData) {
      setCurrentStep(1);
      return;
    }
    if (!hasFile) {
      setCurrentStep(2);
      return;
    }
    setCurrentStep(3);
  }, [workerName, workerCPF, workerEmail, companyName, companyCNPJ, hasFile]);

  useEffect(() => {
    if (!normalizedCode) return;
    const normalizedInput = unionCodeInput.trim().toUpperCase().replace(/[\s-]+/g, "");
    if (normalizedInput !== normalizedCode) {
      setNormalizedCode(null);
      setCodeState("idle");
      setCodeFeedback("Codigo alterado. Clique em Aplicar para validar novamente.");
    }
  }, [unionCodeInput, normalizedCode]);

  async function handleApplyUnionCode() {
    const rawCode = unionCodeInput.trim();
    if (!rawCode) {
      setNormalizedCode(null);
      setCodeState("idle");
      setCodeFeedback(null);
      return;
    }

    setCodeState("validating");
    setCodeFeedback(null);
    setError(null);

    try {
      const result = await validateUnionCodePublic(rawCode);
      if (result.valid) {
        setNormalizedCode(result.normalized_code || rawCode.toUpperCase());
        setCodeState("valid");
        setCodeFeedback("Codigo aplicado com sucesso.");
      } else {
        setNormalizedCode(null);
        setCodeState("invalid");
        setCodeFeedback("Codigo invalido ou expirado.");
      }
    } catch (err) {
      setNormalizedCode(null);
      setCodeState("invalid");
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setCodeFeedback("Codigo invalido ou expirado.");
        } else if (err.status === 400) {
          setCodeFeedback("Formato de codigo invalido.");
        } else if (err.status === 429) {
          setCodeFeedback("Muitas tentativas. Aguarde um minuto.");
        } else {
          setCodeFeedback("Nao foi possivel validar este codigo agora.");
        }
      } else {
        setCodeFeedback("Nao foi possivel validar este codigo agora.");
      }
    }
  }

  async function handleCreateCase() {
    const trimmedWorkerName = workerName.trim();
    const trimmedCompanyName = companyName.trim();
    const cpfDigits = digitsOnly(workerCPF);
    const cnpjDigits = digitsOnly(companyCNPJ);

    if (!trimmedWorkerName) {
      setError("Informe o nome do trabalhador.");
      return;
    }
    if (cpfDigits.length !== 11) {
      setError("Informe um CPF valido com 11 digitos.");
      return;
    }
    if (!isValidEmail(workerEmail)) {
      setError("Informe um email valido.");
      return;
    }
    if (!trimmedCompanyName) {
      setError("Informe o nome da empresa conforme consta no PPP.");
      return;
    }
    if (cnpjDigits.length !== 14) {
      setError("Informe um CNPJ valido com 14 digitos.");
      return;
    }
    if (!selectedFile) {
      setError("Anexe o PDF do PPP para continuar.");
      return;
    }
    if (selectedFile.size > MAX_PDF_MB * 1024 * 1024) {
      setError(`Arquivo muito grande. Envie um PDF de ate ${MAX_PDF_MB}MB.`);
      return;
    }

    setSubmitting(true);
    setSlowSubmit(false);
    setError(null);
    const timer = window.setTimeout(() => setSlowSubmit(true), 20000);

    try {
      const created = await createPublicCase({
        workerName: trimmedWorkerName,
        workerCPF: cpfDigits,
        workerEmail: workerEmail.trim(),
        companyName: trimmedCompanyName,
        companyCNPJ: cnpjDigits,
        unionCode: normalizedCode || undefined,
        file: selectedFile,
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

      setError("Caso criado, mas nao foi possivel abrir o pagamento automaticamente.");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 413) {
          setError(`Arquivo muito grande. Envie um PDF de ate ${MAX_PDF_MB}MB.`);
        } else if (err.code === "worker_cpf_conflict") {
          setError("CPF ja cadastrado com outro nome nesta organizacao.");
        } else if (err.status === 409) {
          setError("Pagamento ja iniciado para este caso.");
        } else if (err.code === "invalid_union_code") {
          setError("Codigo do sindicato invalido.");
        } else if (err.code === "invalid_email") {
          setError("Email invalido.");
        } else {
          setError(mapCreateCaseErrorMessage(err) || "Nao foi possivel concluir o envio.");
        }
      } else {
        setError("Nao foi possivel concluir o envio.");
      }
    } finally {
      window.clearTimeout(timer);
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Analise do PPP</h1>
            <p className="mt-2 text-sm text-slate-600">
              Preencha os dados como constam no documento, envie o PDF e siga para o pagamento.
            </p>
            <p className="mt-1 text-xs text-slate-500">Se houver divergencia, voce podera corrigir os dados depois.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/ppp">
              <Button variant="outline">Voltar</Button>
            </Link>
            {lastCaseId && (
              <Link href={`/ppp/${lastCaseId}`}>
                <Button variant="outline">Retomar caso</Button>
              </Link>
            )}
          </div>
        </div>

        <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
          {[
            { id: 1, title: "Dados" },
            { id: 2, title: "Documento" },
            { id: 3, title: "Preco" },
            { id: 4, title: "Pagamento" },
          ].map((step) => {
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            return (
              <div
                key={step.id}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  isDone
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : isActive
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <p className="text-xs font-medium">Etapa {step.id}</p>
                <p className="mt-1 font-semibold">{step.title}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Dados do trabalhador e empresa</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs text-slate-600">
                  Nome do trabalhador *
                  <input
                    value={workerName}
                    onChange={(event) => setWorkerName(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  CPF *
                  <input
                    value={formatCpf(workerCPF)}
                    onChange={(event) => setWorkerCPF(digitsOnly(event.target.value))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">Use apenas numeros.</span>
                </label>
                <label className="text-xs text-slate-600">
                  Email para receber o link *
                  <input
                    type="email"
                    value={workerEmail}
                    onChange={(event) => setWorkerEmail(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Empresa *
                  <input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">Preencha como aparece no PPP.</span>
                </label>
                <label className="text-xs text-slate-600 md:col-span-2">
                  CNPJ *
                  <input
                    value={formatCnpj(companyCNPJ)}
                    onChange={(event) => setCompanyCNPJ(digitsOnly(event.target.value))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">Use apenas numeros.</span>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Documento</h2>
              <p className="mt-1 text-sm text-slate-600">Envie o PDF do PPP para criar o caso.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Escolher arquivo
                </Button>
                <span className="text-sm text-slate-600">
                  {selectedFile ? selectedFile.name : "Nenhum arquivo escolhido"}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Tamanho recomendado: ate {MAX_PDF_MB}MB.</p>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 h-fit">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Codigo do sindicato (opcional)</h3>
              <p className="mt-1 text-sm text-slate-600">Se voce recebeu um codigo, aplique para liberar desconto.</p>
              <div className="mt-4 flex gap-2">
                <input
                  value={unionCodeInput}
                  onChange={(event) => setUnionCodeInput(event.target.value)}
                  placeholder="Ex.: SINDICATO2026"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <Button
                  onClick={handleApplyUnionCode}
                  disabled={codeState === "validating"}
                  className="bg-slate-900 text-white hover:bg-slate-950"
                >
                  {codeState === "validating" ? "Validando..." : "Aplicar"}
                </Button>
              </div>
              {codeFeedback && (
                <p className={`mt-2 text-xs ${codeState === "valid" ? "text-emerald-700" : "text-red-600"}`}>
                  {codeFeedback}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Resumo do preco</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Preco padrao</span>
                  <span>{formatPrice(BASE_PRICE)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Desconto</span>
                  <span>{formatPrice(discountAmount)}</span>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex items-center justify-between font-semibold text-slate-900">
                  <span>Preco final</span>
                  <span>{formatPrice(finalPrice)}</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Sem codigo: R$ 87,90. Com codigo valido: R$ 67,90.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Proxima acao</h3>
              <p className="mt-2 text-sm text-slate-600">Ao continuar, o caso sera criado e o link de pagamento sera gerado.</p>
              <label className="mt-3 flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={lgpdAccepted}
                  onChange={(event) => setLgpdAccepted(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Declaro que li e autorizo o tratamento dos dados pessoais para analise do PPP, conforme a LGPD.
                </span>
              </label>
              <Button
                onClick={handleCreateCase}
                disabled={!canContinue}
                className="mt-4 w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {submitting ? "Criando e gerando pagamento..." : "Continuar para pagamento"}
              </Button>
              {!lgpdAccepted && (
                <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                  Consentimento LGPD obrigatorio para prosseguir.
                </p>
              )}
              {!canContinue && (
                <p className="mt-2 text-xs text-amber-700">
                  Preencha os campos obrigatorios, envie o PDF e valide (ou limpe) o codigo para continuar.
                </p>
              )}
              {caseId && (
                <p className="mt-3 text-xs text-slate-600">
                  Caso criado com sucesso.{" "}
                  <Link className="text-blue-700 hover:underline" href={`/ppp/${caseId}`}>
                    Abrir acompanhamento
                  </Link>
                </p>
              )}
              {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
              {slowSubmit && !error && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  O envio esta demorando mais que o normal. Se houver queda de conexao, use Retomar caso.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Se sua internet cair</h3>
              <p className="mt-2 text-sm text-slate-600">
                Voce pode retomar o caso pelo codigo salvo automaticamente no navegador.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
