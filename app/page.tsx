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
  const [simMessage, setSimMessage] = useState("Sem codigo: R$ 87,90. Com codigo valido: R$ 67,90.");
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
      setSimMessage("Sem codigo: R$ 87,90. Com codigo valido: R$ 67,90.");
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
          setSimMessage(`Codigo aplicado${orgName}. Desconto liberado.`);
        } else {
          setSimPrice(BASE_PRICE);
          setSimMessage("Codigo nao encontrado. Preco sem desconto.");
        }
      } catch {
        setSimPrice(BASE_PRICE);
        setSimMessage("Nao foi possivel validar agora. Voce pode tentar novamente.");
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
              <div className="text-xs text-gray-500">Meu Perfil Profissiografico Previdenciario</div>
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
            <Button
              onClick={() => router.push("/login")}
              className="hidden md:inline-flex bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 text-sm font-semibold min-w-[190px]"
            >
              Entrar como sindicato
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
          <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
            <div className="space-y-6">
              <p className="text-sm uppercase tracking-wide text-blue-100">Meu Perfil Profissiografico Previdenciario</p>
              <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
                Auditoria tecnica de PPP em minutos, nao em dias.
              </h1>
              <p className="text-lg text-blue-100">
                Ferramenta para advogados, peritos, empresas e trabalhadores conferirem PPP com base na
                IN 128/2022 e nas NRs, gerando parecer tecnico pronto para conferencia humana.
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

              <div className="max-w-3xl rounded-lg border border-white/30 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">Simule seu preco com codigo do sindicato</p>
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                  <input
                    type="text"
                    value={simCode}
                    onChange={(e) => setSimCode(e.target.value.toUpperCase())}
                    placeholder="Digite o codigo (opcional)"
                    className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 md:max-w-sm"
                  />
                  <div className="rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm text-white">
                    Preco final: <span className="font-bold">{formatCurrency(simPrice)}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-blue-100">
                  {simLoading ? "Validando codigo..." : simMessage}
                </p>
                <p className="mt-1 text-xs text-blue-100">
                  Leva cerca de 3 minutos para criar o caso e gerar o link de pagamento.
                </p>
              </div>

              {user && (
                <div className="text-xs text-blue-100">
                  Voce ja esta logado.{" "}
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
            <h2 className="text-3xl font-bold">Como funciona</h2>
            <p className="text-gray-600">Tres passos simples para obter um parecer tecnico estruturado.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "1) Envie o PPP",
                text: "Upload do PPP em PDF (escaneado ou digital).",
              },
              {
                title: "2) Protocolo oficial",
                text: "Aplicamos o protocolo baseado na IN 128/2022 e NRs.",
              },
              {
                title: "3) Parecer tecnico",
                text: "Voce recebe um parecer estruturado para revisao humana.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-lg shadow p-6 space-y-3">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border-t border-b py-14">
          <div className="max-w-6xl mx-auto px-6 space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold">Para quem e</h2>
              <p className="text-gray-600">
                A plataforma ajuda equipes tecnicas, juridicas e trabalhadores que precisam de atestado profissional do PPP.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                "Trabalhadores",
                "Advogados previdenciarios",
                "Escritorios de contabilidade",
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
            <h2 className="text-3xl font-bold">Beneficios</h2>
            <ul className="space-y-2 text-gray-700 list-disc list-inside">
              <li>Reduz o tempo de auditoria de PPP.</li>
              <li>Padroniza pareceres tecnicos.</li>
              <li>Identifica PPP invalido antes do requerimento ou acao.</li>
              <li>Gera documentacao tecnica mais robusta.</li>
              <li>Ajuda trabalhadores a verificar a validade do PPP para atestado profissional.</li>
            </ul>
          </div>
          <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <h3 className="text-xl font-semibold">Pronto para usar</h3>
            <p className="text-gray-600">
              Escolha o acesso ideal para voce e acompanhe os PPPs gerados por caso com pagamento confirmado.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push("/ppp/novo")}
                className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 text-base font-semibold"
              >
                Validar meu PPP
              </Button>
              <Button
                onClick={() => router.push("/login")}
                className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 text-sm font-semibold opacity-90"
              >
                Entrar como sindicato
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap justify-between text-sm text-gray-600">
          <span>PPP Auditor - Parecer tecnico simplificado</span>
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
