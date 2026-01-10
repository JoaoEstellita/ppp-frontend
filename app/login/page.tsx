"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/authContext";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, signInWithGoogle } = useAuth();
  const { loading: orgLoading, isPlatformAdmin, org } = useOrgAccess();

  useEffect(() => {
    if (!loading && !orgLoading && session) {
      if (isPlatformAdmin) {
        router.replace("/admin");
      } else if (org?.slug) {
        router.replace(`/s/${org.slug}/dashboard`);
      }
    }
  }, [loading, orgLoading, session, isPlatformAdmin, org?.slug, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Bem vindo</h2>
          <p className="text-gray-600 text-sm">
            Use sua conta Google corporativa para acessar a plataforma PPP.
          </p>
        </div>
        <Button
          onClick={signInWithGoogle}
          className="w-full"
          disabled={loading}
        >
          Entrar com Google
        </Button>
      </div>
    </div>
  );
}

