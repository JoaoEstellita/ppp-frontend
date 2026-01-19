"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";

export default function PublicLandingPage() {
  const router = useRouter();
  const [lastCaseId, setLastCaseId] = useState<string | null>(null);
  const [caseLookup, setCaseLookup] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("ppp:last_case_id");
    if (stored) setLastCaseId(stored);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-gray-900">PPP para trabalhador</h1>
        <p className="text-sm text-gray-600">
          Envie seu PPP, acompanhe o processamento e receba o resultado com segurança.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <p className="text-sm text-gray-700">
          Você pode iniciar a análise agora. Se tiver um código do sindicato, o desconto é aplicado automaticamente.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/ppp/novo">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Criar novo caso</Button>
          </Link>
          {lastCaseId && (
            <Link href={`/ppp/${lastCaseId}`}>
              <Button variant="outline">Retomar meu caso</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-3">
        <p className="text-sm text-gray-700">Já tem o código do caso?</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={caseLookup}
            onChange={(event) => setCaseLookup(event.target.value)}
            placeholder="Informe o código do caso"
            className="flex-1 min-w-[220px] rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (caseLookup.trim()) {
                router.push(`/ppp/${caseLookup.trim()}`);
              }
            }}
          >
            Acompanhar
          </Button>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Tem um sindicato? Solicite o código e aplique no formulário antes do pagamento.
      </div>

      <div className="text-xs text-gray-500">
        Acesso para sindicatos e administradores: <Link className="text-blue-600 hover:underline" href="/login">Entrar</Link>
      </div>
    </div>
  );
}
