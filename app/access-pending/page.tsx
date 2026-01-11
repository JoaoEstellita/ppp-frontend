"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/authContext";

export default function AccessPendingPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // Se não tem usuário autenticado, redireciona para login
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center">
        <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Acesso Pendente</h2>
          <p className="text-slate-600">
            Sua conta foi criada, mas ainda não está vinculada a um sindicato.
          </p>
        </div>

        {user?.email && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm text-slate-500">Logado como:</p>
            <p className="text-slate-900 font-medium">{user.email}</p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Entre em contato com o administrador do seu sindicato ou com nosso suporte
            para solicitar acesso.
          </p>

          <a
            href="mailto:contato@conectivos.net"
            className="inline-block text-blue-600 hover:underline font-medium"
          >
            contato@conectivos.net
          </a>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <Button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full bg-slate-600 hover:bg-slate-700 text-white"
          >
            {loggingOut ? "Saindo..." : "Sair"}
          </Button>
        </div>
      </div>
    </div>
  );
}
