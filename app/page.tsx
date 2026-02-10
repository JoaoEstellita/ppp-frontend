"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";
import { Button } from "@/components/Button";
import { validateUnionCodePublic } from "@/src/services/api";

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPlatformAdmin, org } = useOrgAccess();

  const BASE_PRICE = 87.9;
  const [simCode, setSimCode] = useState("");
  const [simPrice, setSimPrice] = useState(BASE_PRICE);
  const [simMessage, setSimMessage] = useState("Sem código: R$ 87,90. Com código válido: R$ 67,90.");
  const [simLoading, setSimLoading] = useState(false);

  const dashboardHref = isPlatformAdmin
    ? "/admin"
    : org?.slug
      ? `/s/${org.slug}/dashboard`
      : "/login";

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const raw = simCode.trim();

    if (!raw) {
      setSimPrice(BASE_PRICE);
      setSimMessage("Sem código: R$ 87,90. Com código válido: R$ 67,90.");
      setSimLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSimLoading(true);
      try {
        const result = await validateUnionCodePublic(raw);
        if (result.valid) {
          setSimPrice(result.price);
          const orgName = result.org_name ? ` (${result.org_name})` : "";
          setSimMessage(`Código aplicado${orgName}. Desconto liberado.`);
        } else {
          setSimPrice(BASE_PRICE);
          setSimMessage("Código não encontrado. Preço sem desconto.");
        }
      } catch {
        setSimPrice(BASE_PRICE);
        setSimMessage("Não foi possível validar agora. Você pode tentar novamente.");
      } finally {
        setSimLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [simCode]);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-600 text-white flex items-center justify-center font-bold">
              MP
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight">Meu PPP</div>
              <div className="text-xs text-gray-500">Meu Perfil Profissiográfico Previdenciário</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push("/ppp")}
              className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 text-base font-semibold min-w-[250px]"
            >
              Entrar como Trabalhador
            </Button>
            <button
              onClick={() => router.push("/login")}
              className="md:hidden text-sm font-medium text-blue-700 underline"
            >
              Portal sindicato
            </button>
            <div className="hidden md:flex flex-col items-start gap-1">
              <Button
                onClick={() => router.push("/login")}
                className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 text-sm font-semibold min-w-[190px]"
              >
                Entrar como sindicato
              </Button>
              <span className="text-xs text-gray-500">Portal interno para gestão de casos.</span>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
          <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
            <div className="space-y-6">
              <p className="text-sm uppercase tracking-wide text-blue-100">Meu Perfil Profissiográfico Previdenciário</p>
              <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
                Auditoria técnica de PPP em minutos, não em dias.
              </h1>
              <p className="text-lg text-blue-100">
                Ferramenta para advogados, peritos, empresas e trabalhadores conferirem PPP com base na
                IN 128/2022 e nas NRs, gerando parecer técnico pronto para conferência humana.
                Ideal para quem precisa de atestado profissional do PPP.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => router.push("/ppp/novo")}
                  className="border border-white bg-blue-700 hover:bg-blue-800 text-white"
                >
                  Validar meu PPP
                </Button>
                <Button
                  onClick={() => scrollTo("como-funciona")}
                  className="border border-blue-200 bg-transparent text-blue-50 hover:bg-white/10"
                >
                  Ver como funciona
                </Button>
              </div>

              <div className="max-w-3xl rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">Simule seu preço com código do sindicato</p>
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                  <input
                    type="text"
                    value={simCode}
                    onChange={(e) => setSimCode(e.target.value.toUpperCase())}
                    placeholder="Digite o código (opcional)"
                    className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 md:max-w-sm"
                  />
                  <div className="rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm text-white">
                    Preço final: <span className="font-bold">{formatCurrency(simPrice)}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-blue-100">
                  {simLoading ? "Validando código..." : simMessage}
                </p>
                <p className="mt-1 text-xs text-blue-100">
                  Leva cerca de 3 minutos para criar o caso e gerar o link de pagamento.
                </p>
              </div>

              {user && (
                <div className="text-xs text-blue-100">
                  Você já está logado.{" "}
                  <button className="underline" onClick={() => router.push(dashboardHref)}>
                    Ir para o painel
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="max-w-6xl mx-auto px-6 py-14 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold">Como validar seu PPP em 3 etapas</h2>
            <p className="text-gray-600">Leva em média 3 a 5 minutos para enviar os dados e gerar o pagamento.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "1) Envie o PDF do PPP",
                text: "Formato PDF. Tamanho recomendado: até 5 MB.",
              },
              {
                title: "2) Confirme e pague",
                text: "Valor padrão R$ 87,90. Com código do sindicato válido: R$ 67,90.",
              },
              {
                title: "3) Acompanhe e baixe o resultado",
                text: "Você acompanha o status e baixa o parecer quando concluir.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-lg shadow p-6 space-y-3">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => router.push("/ppp/novo")}
              className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 text-base font-semibold"
            >
              Validar meu PPP
            </Button>
            <Button
              onClick={() => scrollTo("como-funciona")}
              className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              Ver como funciona
            </Button>
          </div>
          <p className="text-center text-sm text-gray-600">
            O código do caso também aparece no link de pagamento. Guarde esse código para retomar o acesso quando precisar.
          </p>
        </section>

        <section className="bg-white border-t border-b py-14">
          <div className="max-w-6xl mx-auto px-6 space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold">Para quem é</h2>
              <p className="text-gray-600">
                A plataforma ajuda equipes técnicas, jurídicas e trabalhadores que precisam de atestado profissional do PPP.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                "Trabalhadores",
                "Advogados previdenciários",
                "Escritórios de contabilidade",
                "Departamentos de RH/SSO",
                "Peritos e consultores",
              ].map((label) => (
                <div key={label} className="bg-gray-50 border rounded-lg p-4 text-center text-sm font-medium">
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-14 grid lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold">Benefícios</h2>
            <ul className="space-y-2 text-gray-700 list-disc list-inside">
              <li>Reduz o tempo de auditoria de PPP.</li>
              <li>Padroniza pareceres técnicos.</li>
              <li>Identifica PPP inválido antes do requerimento ou ação.</li>
              <li>Gera documentação técnica mais robusta.</li>
              <li>Ajuda trabalhadores a verificar a validade do PPP para atestado profissional.</li>
            </ul>
          </div>
          <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <h3 className="text-xl font-semibold">Pronto para usar</h3>
            <p className="text-gray-600">
              Escolha o acesso ideal para você e acompanhe os PPPs gerados por caso com pagamento confirmado.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push("/ppp/novo")}
                className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 text-base font-semibold"
              >
                Validar meu PPP
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap justify-between text-sm text-gray-600">
          <span>PPP Auditor - Parecer técnico simplificado</span>
          <div className="flex gap-4">
            <button onClick={() => router.push("/ppp")} className="hover:text-gray-900">
              Validar meu PPP
            </button>
            <button onClick={() => router.push("/login")} className="hover:text-gray-900">
              Entrar como sindicato
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
