import Link from "next/link";
import { Button } from "@/components/Button";

export default function PublicLandingPage() {
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
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Já iniciou? Informe o código do seu caso para acompanhar o status.
      </div>
    </div>
  );
}