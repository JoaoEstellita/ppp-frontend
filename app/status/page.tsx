"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL, validateUnionCodePublic } from "@/src/services/api";

type ServiceState = "operational" | "degraded" | "down" | "unknown";

type StatusItem = {
  id: string;
  name: string;
  state: ServiceState;
  detail: string;
};

function stateStyles(state: ServiceState): string {
  if (state === "operational") return "bg-green-100 text-green-700";
  if (state === "degraded") return "bg-amber-100 text-amber-700";
  if (state === "down") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

export default function StatusPage() {
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [apiState, setApiState] = useState<ServiceState>("unknown");
  const [apiDetail, setApiDetail] = useState("Ainda nao verificado.");
  const [publicFlowState, setPublicFlowState] = useState<ServiceState>("unknown");
  const [publicFlowDetail, setPublicFlowDetail] = useState("Ainda nao verificado.");

  const supabaseConfigured = useMemo(() => {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }, []);

  async function runChecks() {
    setLoading(true);
    try {
      const apiResponse = await fetch(API_BASE_URL, { method: "GET" });
      setApiState(apiResponse.ok || apiResponse.status === 404 ? "operational" : "degraded");
      setApiDetail(`Backend respondeu com status HTTP ${apiResponse.status}.`);
    } catch (err) {
      setApiState("down");
      setApiDetail("Nao foi possivel conectar ao backend da plataforma.");
    }

    try {
      await validateUnionCodePublic("STATUS-CHECK");
      setPublicFlowState("operational");
      setPublicFlowDetail("Validacao publica de codigo sindical respondendo normalmente.");
    } catch {
      setPublicFlowState("degraded");
      setPublicFlowDetail("Fluxo publico com instabilidade no momento.");
    }

    setCheckedAt(new Date().toISOString());
    setLoading(false);
  }

  useEffect(() => {
    runChecks();
  }, []);

  const items: StatusItem[] = [
    {
      id: "frontend",
      name: "Frontend (Vercel)",
      state: "operational",
      detail: "Pagina de status carregada com sucesso.",
    },
    {
      id: "backend",
      name: "Backend PPP",
      state: apiState,
      detail: apiDetail,
    },
    {
      id: "public-flow",
      name: "Fluxo publico (validacao de codigo)",
      state: publicFlowState,
      detail: publicFlowDetail,
    },
    {
      id: "supabase",
      name: "Supabase (configuracao)",
      state: supabaseConfigured ? "operational" : "degraded",
      detail: supabaseConfigured
        ? "Variaveis de ambiente configuradas no frontend."
        : "Variaveis de ambiente ausentes no frontend.",
    },
    {
      id: "n8n",
      name: "N8N (callbacks)",
      state: "unknown",
      detail: "Monitorado indiretamente via callbacks dos casos.",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Status operacional</h1>
          <p className="text-sm text-gray-600 mt-1">
            Acompanhe a disponibilidade dos servicos principais da plataforma.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Ultima verificacao: {checkedAt ? new Date(checkedAt).toLocaleString("pt-BR") : "-"}
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          SLA de referencia: retorno da analise tecnica em ate 15 minutos apos envio para processamento.
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-900">{item.name}</h2>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${stateStyles(item.state)}`}>
                  {item.state}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-600">
          {loading
            ? "Executando verificacoes de disponibilidade..."
            : "Se algum servico estiver degradado, aguarde alguns minutos e tente novamente."}
        </div>
      </div>
    </div>
  );
}
