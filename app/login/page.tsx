"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/authContext";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, signInWithGoogle, signInWithEmail } = useAuth();
  const { loading: orgLoading, isPlatformAdmin, org } = useOrgAccess();

  const [email, setEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !orgLoading && session) {
      if (isPlatformAdmin) {
        router.replace("/admin");
      } else if (org?.slug) {
        router.replace(`/s/${org.slug}/dashboard`);
      }
      // Se não tem org nem é admin, não redireciona (será tratado no callback)
    }
  }, [loading, orgLoading, session, isPlatformAdmin, org?.slug, router]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setEmailSending(true);
    setEmailError(null);

    const result = await signInWithEmail(email.trim());

    setEmailSending(false);

    if (result.error) {
      setEmailError(result.error);
    } else {
      setEmailSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-slate-900">PPP Análise</h2>
          <p className="text-slate-600 text-sm">
            Acesse a plataforma para gerenciar seus casos de PPP.
          </p>
        </div>

        {/* Botão Google */}
        <Button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
          disabled={loading}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Entrar com Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">ou</span>
          </div>
        </div>

        {/* Formulário de Email */}
        {!emailSent ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                required
              />
            </div>
            {emailError && (
              <p className="text-sm text-red-600">{emailError}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={emailSending || !email.trim()}
            >
              {emailSending ? "Enviando..." : "Enviar link mágico"}
            </Button>
          </form>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-800 font-medium">Link enviado!</p>
            <p className="text-green-700 text-sm mt-1">
              Verifique seu email <strong>{email}</strong> e clique no link para entrar.
            </p>
            <button
              onClick={() => {
                setEmailSent(false);
                setEmail("");
              }}
              className="text-blue-600 text-sm mt-3 hover:underline"
            >
              Tentar outro email
            </button>
          </div>
        )}

        {/* Link de contato */}
        <div className="text-center pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Precisa de ajuda?{" "}
            <a
              href="mailto:contato@conectivos.net"
              className="text-blue-600 hover:underline font-medium"
            >
              contato@conectivos.net
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
