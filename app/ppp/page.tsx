"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

function formatCaseId(caseId: string) {
  if (!caseId) return "";
  if (caseId.length <= 12) return caseId;
  return `${caseId.slice(0, 8)}...${caseId.slice(-4)}`;
}

export default function PublicLandingPage() {
  const router = useRouter();
  const [lastCaseId, setLastCaseId] = useState<string | null>(null);
  const [lookupCaseId, setLookupCaseId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedCaseId = window.localStorage.getItem("ppp:last_case_id");
    if (storedCaseId) {
      setLastCaseId(storedCaseId);
    }
  }, []);

  const hasLookupValue = lookupCaseId.trim().length > 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-8 text-white shadow-xl">
            <p className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium">
              Fluxo do trabalhador
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              Envie seu PPP e acompanhe cada etapa em um so lugar
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-blue-50 sm:text-base">
              Preencha os dados, envie o PDF, aplique o codigo do sindicato se tiver e acompanhe o status ate o resultado final.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-wide text-blue-100">Passo 1</p>
                <p className="mt-2 text-sm font-medium">Criar caso e enviar PDF</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-wide text-blue-100">Passo 2</p>
                <p className="mt-2 text-sm font-medium">Gerar e pagar o link</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-wide text-blue-100">Passo 3</p>
                <p className="mt-2 text-sm font-medium">Acompanhar e baixar resultado</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/ppp/novo">
                <Button className="bg-slate-900 text-white hover:bg-slate-800">
                  Iniciar agora
                </Button>
              </Link>
              {lastCaseId && (
                <Link href={`/ppp/${lastCaseId}`}>
                  <Button
                    variant="outline"
                    className="border-white/60 bg-transparent text-white hover:bg-white/10"
                  >
                    Retomar caso recente
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Retomar caso</h2>
              <p className="mt-2 text-sm text-slate-600">
                Se voce ja criou um caso, informe o codigo para abrir o acompanhamento.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  value={lookupCaseId}
                  onChange={(event) => setLookupCaseId(event.target.value)}
                  placeholder="Ex.: 53204d9c-..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <Button
                  disabled={!hasLookupValue}
                  onClick={() => router.push(`/ppp/${lookupCaseId.trim()}`)}
                  className="bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40"
                >
                  Acessar
                </Button>
              </div>
              {lastCaseId && (
                <p className="mt-3 text-xs text-slate-500">
                  Ultimo caso salvo:{" "}
                  <Link className="text-blue-700 hover:underline" href={`/ppp/${lastCaseId}`}>
                    {formatCaseId(lastCaseId)}
                  </Link>
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Desconto com codigo do sindicato</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Sem codigo: R$ 87,90</li>
                <li>Com codigo valido: R$ 67,90</li>
                <li>Use o codigo informado pelo seu sindicato para economizar R$ 20,00.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Acesso sindicato/admin</h3>
              <p className="mt-2 text-sm text-slate-600">
                Para gestao de casos do sindicato, use o portal interno.
              </p>
              <div className="mt-3">
                <Link className="text-sm font-medium text-blue-700 hover:underline" href="/login">
                  Entrar no portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
