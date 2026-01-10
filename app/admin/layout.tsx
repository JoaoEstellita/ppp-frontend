"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/lib/authContext";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { loading: orgLoading, isPlatformAdmin, org } = useOrgAccess();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (loading || orgLoading || !session) return;
    if (!isPlatformAdmin && org?.slug) {
      router.replace(`/s/${org.slug}/dashboard`);
    }
  }, [loading, orgLoading, session, isPlatformAdmin, org?.slug, router]);

  if (loading || orgLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Verificando autenticacao...
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return null;
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

