"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

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

      const slug = (member as any)?.organizations?.slug;
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
