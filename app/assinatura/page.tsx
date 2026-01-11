"use client";

import { Button } from "@/components/Button";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "next/navigation";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";

/**
 * Página de informações sobre o modelo de pagamento.
 * O modelo antigo de assinatura foi substituído por pagamento por caso (R$ 67,90 por PPP).
 */
export default function PaymentInfoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { loading, isPlatformAdmin, org } = useOrgAccess();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700">
        Carregando...
      </div>
    );
  }

  const handleGoToDashboard = () => {
    if (isPlatformAdmin) {
      router.push("/admin");
    } else if (org?.slug) {
      router.push(`/s/${org.slug}/dashboard`);
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <p className="text-sm text-blue-600 font-semibold">Como funciona</p>
          <h1 className="text-3xl font-bold">Pagamento por Caso</h1>
          <p className="text-gray-600">
            O modelo de pagamento é simples: você paga apenas pelos casos que deseja processar.
            Cada PPP gerado custa <strong>R$ 67,90</strong>.
          </p>
        </div>

        {user && (
          <div className="bg-white shadow rounded-lg p-4 border">
            <p className="text-sm text-gray-600">Usuário conectado</p>
            <p className="text-base font-medium">{user.email}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Como funciona</h2>
            
            <div className="space-y-3 text-gray-700">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium">Crie o caso</p>
                  <p className="text-sm text-gray-600">Informe os dados do trabalhador e da empresa.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium">Gere o link de pagamento</p>
                  <p className="text-sm text-gray-600">Um link do Mercado Pago será gerado para pagamento de R$ 67,90.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium">Pagamento confirmado</p>
                  <p className="text-sm text-gray-600">Após o pagamento, o PPP é gerado automaticamente.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold text-sm">
                  4
                </div>
                <div>
                  <p className="font-medium">Download do PDF</p>
                  <p className="text-sm text-gray-600">O PDF do PPP fica disponível para download no sistema.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-blue-900">Valor por caso: R$ 67,90</p>
            <p className="text-sm text-blue-800">
              Você só paga quando precisa gerar um PPP. Sem mensalidades ou taxas adicionais.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleGoToDashboard}>
              Ir para o Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
