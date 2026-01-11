"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { syncMembership } from "@/src/services/api";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Concluindo autenticação...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Aguarda a sessão ser estabelecida
        const { data } = await supabaseClient.auth.getSession();
        const user = data.session?.user;

        if (!user) {
          router.replace("/login");
          return;
        }

        setStatus("Verificando permissões...");

        // Tenta sincronizar membership (aceitar convite se existir)
        try {
          const syncResult = await syncMembership();

          if (syncResult.status === "platform_admin") {
            router.replace("/admin");
            return;
          }

          if (syncResult.status === "already_member" || syncResult.status === "invite_accepted") {
            if (syncResult.org_slug) {
              router.replace(`/s/${syncResult.org_slug}/dashboard`);
              return;
            }
          }

          // no_invite: usuário não tem convite nem membership
          router.replace("/access-pending");
        } catch (syncError) {
          console.error("Erro ao sincronizar membership:", syncError);
          
          // Fallback: verificar diretamente no Supabase
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

          const orgs = member?.organizations;
          const slug = Array.isArray(orgs) ? orgs[0]?.slug : (orgs as any)?.slug;
          
          if (slug) {
            router.replace(`/s/${slug}/dashboard`);
            return;
          }

          // Sem acesso
          router.replace("/access-pending");
        }
      } catch (error) {
        console.error("Erro no callback de auth:", error);
        router.replace("/login");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600">{status}</p>
      </div>
    </div>
  );
}
