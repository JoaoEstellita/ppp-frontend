"use client";

import { Button } from "@/components/Button";
import { useAuth } from "@/lib/authContext";
import { useSubscription } from "@/src/hooks/useSubscription";
import { useRouter } from "next/navigation";

export default function SubscriptionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { active, loading, subscription } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">
        Verificando sua assinatura...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <p className="text-sm text-blue-600 font-semibold">Assinatura</p>
          <h1 className="text-3xl font-bold">Ative sua assinatura</h1>
          <p className="text-gray-600">
            A plataforma está em fase piloto. A ativação é manual e feita por e-mail neste MVP.
          </p>
        </div>

        {user && (
          <div className="bg-white shadow rounded-lg p-4 border">
            <p className="text-sm text-gray-600">Usuário conectado</p>
            <p className="text-base font-medium">{user.email}</p>
          </div>
        )}

        {active ? (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 space-y-2">
            <p className="font-semibold">Sua assinatura já está ativa.</p>
            <p className="text-sm">
              Você pode usar a plataforma normalmente. Acesse seus casos para enviar PPP e gerar parecer.
            </p>
            <Button onClick={() => router.push("/cases")}>Ir para meus casos</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border rounded-lg p-6 shadow-sm space-y-3">
              <h2 className="text-xl font-semibold">Como ativar</h2>
              <p className="text-gray-700">
                Envie um e-mail para <span className="font-semibold">contato@exemplo.com</span> com o assunto
                <span className="font-semibold"> “Assinatura PPP”</span> informando o e-mail que você usa aqui na plataforma.
              </p>
              <p className="text-gray-700">
                Após confirmação do pagamento, sua assinatura será ativada manualmente e você poderá utilizar a ferramenta.
              </p>
              <p className="text-gray-600 text-sm">
                Em breve adicionaremos pagamento online direto na plataforma.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => router.push("/cases")}>
                  Voltar para casos
                </Button>
              </div>
            </div>
            <div className="border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-600">
              Botão de pagamento (futuro): integrar gateway de pagamento aqui.
            </div>
          </div>
        )}

        {subscription && (
          <div className="bg-white border rounded-lg p-4 shadow-sm space-y-2">
            <h3 className="text-lg font-semibold">Dados da assinatura</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>Status: {subscription.status}</p>
              {subscription.plan && <p>Plano: {subscription.plan}</p>}
              {subscription.current_period_end && (
                <p>Vigente até: {new Date(subscription.current_period_end).toLocaleString("pt-BR")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
