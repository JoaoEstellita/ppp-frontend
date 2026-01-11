"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Extrai o slug da organização do resultado do Supabase.
 * O join pode retornar array ou objeto.
 */
function extractOrgSlug(organizations: unknown): string | null {
  if (!organizations) return null;

  // Se for array, pega o primeiro elemento
  if (Array.isArray(organizations)) {
    const first = organizations[0];
    return first?.slug ? String(first.slug) : null;
  }

  // Se for objeto, usa diretamente
  if (typeof organizations === "object") {
    const obj = organizations as Record<string, unknown>;
    return obj.slug ? String(obj.slug) : null;
  }

  return null;
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { data } = await supabaseClient.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: admin } = await supabaseClient
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (admin) {
        router.replace("/admin");
        return;
      }

      const { data: member } = await supabaseClient
        .from("org_members")
        .select("organizations ( slug )")
        .eq("user_id", user.id)
        .maybeSingle();

      const slug = extractOrgSlug(member?.organizations);
      if (slug) {
        router.replace(`/s/${slug}/dashboard`);
        return;
      }

      router.replace("/login");
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
      Concluindo autenticacao...
    </div>
  );
}
