"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";
import { Button } from "@/components/Button";

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPlatformAdmin, org } = useOrgAccess();

  const dashboardHref = isPlatformAdmin
    ? "/admin"
    : org?.slug
    ? `/s/${org.slug}/dashboard`
    : "/login";

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-bold">PPP Auditor</div>
          <div className="flex gap-3">
            <Button
              onClick={() => router.push("/ppp")}
              className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 text-base font-semibold min-w-[250px]"
            >
              Entrar como Trabalhador
            </Button>
            <Button
              onClick={() => router.push("/login")}
              className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 text-sm font-semibold min-w-[190px]"
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
              <p className="text-sm uppercase tracking-wide text-blue-100">Plataforma de auditoria</p>
              <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
                Auditoria tecnica de PPP em minutos, nao em dias.
              </h1>
              <p className="text-lg text-blue-100">
                Ferramenta para advogados, peritos, empresas e trabalhadores conferirem PPP com base na
                IN 128/2022 e nas NRs, gerando parecer tecnico pronto para conferencia humana.
                Ideal para quem precisa de atestado profissional do PPP.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => router.push("/ppp/novo")} className="bg-blue-700 hover:bg-blue-800 text-white">
                  Validar meu PPP
                </Button>
                <Button
                  onClick={() => router.push("/login")}
                  className="border border-blue-200 bg-white/10 text-blue-50 hover:bg-white/20"
                >
                  Entrar como sindicato
                </Button>
                <Button
                  onClick={() => scrollTo("como-funciona")}
                  className="border border-blue-200 bg-transparent text-blue-50 hover:bg-white/10"
                >
                  Ver como funciona
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-blue-100">
                <span className="inline-flex items-center rounded-full border border-blue-200 px-3 py-1 font-medium">
                  Desconto com codigo do sindicato
                </span>
                <span>Leva cerca de 3 minutos para criar o caso e gerar o link de pagamento.</span>
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


