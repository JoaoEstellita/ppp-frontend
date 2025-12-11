"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/lib/authContext";
import { useSubscription } from "@/src/hooks/useSubscription";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { session, loading } = useAuth();
  const {
    active: subscriptionActive,
    loading: subLoading,
  } = useSubscription();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Verificando autenticacao...
      </div>
    );
  }

  if (subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Verificando sua assinatura...
      </div>
    );
  }

  if (!subscriptionActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-700 p-6">
        <div className="max-w-lg w-full bg-white shadow rounded-lg p-6 space-y-4 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Sua assinatura não está ativa.</h2>
          <p className="text-sm text-gray-600">
            É necessário ter uma assinatura ativa para usar a plataforma de auditoria de PPP.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push("/assinatura")}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Ativar assinatura
            </button>
            <button
              onClick={() => router.push("/login")}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
            >
              Trocar usuário
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
