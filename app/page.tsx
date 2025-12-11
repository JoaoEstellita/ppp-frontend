"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { useSubscription } from "@/src/hooks/useSubscription";
import { Button } from "@/components/Button";

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { active: hasSubscription } = useSubscription();

  const primaryHref = !user ? "/login" : hasSubscription ? "/cases" : "/assinatura";

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
            <Button variant="outline" onClick={() => router.push("/login")}>
              Entrar
            </Button>
            <Button onClick={() => router.push(primaryHref)}>Começar agora</Button>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
          <div className="max-w-6xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <p className="text-sm uppercase tracking-wide text-blue-100">Plataforma de Auditoria</p>
              <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
                Auditoria técnica de PPP em minutos, não em dias.
              </h1>
              <p className="text-lg text-blue-100">
                Ferramenta para advogados, peritos e empresas conferirem PPP com base na IN 128/2022
                e nas NRs, gerando parecer técnico pronto para conferência humana.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => router.push(primaryHref)}>Começar agora</Button>
                <Button variant="outline" onClick={() => scrollTo("como-funciona")}>
                  Ver como funciona
                </Button>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20 shadow-lg">
              <h3 className="text-xl font-semibold mb-3">Exemplo de resultado</h3>
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-red-100">
                  Conclusão: NÃO CONFORME para aposentadoria especial
                </p>
                <ul className="list-disc list-inside space-y-1 text-blue-50">
                  <li>Ausência de medições recentes de agentes nocivos.</li>
                  <li>PPP não cita LTCAT ou responsável técnico.</li>
                  <li>Período com códigos de GFIP incompatíveis.</li>
                </ul>
                <p className="text-blue-100 text-xs pt-2">
                  ⚠ Não foram analisados LTCAT, laudos, medições ou eventos S-2240, se expressamente citados no próprio PPP.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="max-w-6xl mx-auto px-6 py-14 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold">Como funciona</h2>
            <p className="text-gray-600">
              Três passos simples para obter um parecer técnico estruturado.
            </p>
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
                title: "3) Parecer técnico",
                text: "Você recebe um parecer estruturado para revisão humana.",
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
              <h2 className="text-3xl font-bold">Para quem é</h2>
              <p className="text-gray-600">A plataforma ajuda equipes técnicas e jurídicas.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              {[
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
            </ul>
          </div>
          <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <h3 className="text-xl font-semibold">Pronto para usar</h3>
            <p className="text-gray-600">
              Acesse com sua conta e use a assinatura ativa para auditar PPPs de forma organizada.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => router.push(primaryHref)}>Começar agora</Button>
              <Button variant="outline" onClick={() => router.push("/assinatura")}>
                Ver planos
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap justify-between text-sm text-gray-600">
          <span>PPP Auditor · Parecer técnico simplificado</span>
          <div className="flex gap-4">
            <button onClick={() => router.push("/login")} className="hover:text-gray-900">
              Entrar
            </button>
            <button onClick={() => router.push("/assinatura")} className="hover:text-gray-900">
              Assinar agora
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
