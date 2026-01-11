import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";

type Org = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type OrgAccess = {
  loading: boolean;
  isPlatformAdmin: boolean;
  org: Org | null;
};

/**
 * Normaliza o resultado do join com organizations.
 * Supabase pode retornar como array ou objeto dependendo do relacionamento.
 */
function normalizeOrg(organizations: unknown): Org | null {
  if (!organizations) return null;

  // Se for array, pega o primeiro elemento
  if (Array.isArray(organizations)) {
    const first = organizations[0];
    if (!first) return null;
    return {
      id: String(first.id ?? ""),
      name: String(first.name ?? ""),
      slug: String(first.slug ?? ""),
      status: String(first.status ?? ""),
    };
  }

  // Se for objeto, usa diretamente
  if (typeof organizations === "object") {
    const obj = organizations as Record<string, unknown>;
    return {
      id: String(obj.id ?? ""),
      name: String(obj.name ?? ""),
      slug: String(obj.slug ?? ""),
      status: String(obj.status ?? ""),
    };
  }

  return null;
}

export function useOrgAccess(): OrgAccess {
  const { user } = useAuth();
  const [state, setState] = useState<OrgAccess>({
    loading: true,
    isPlatformAdmin: false,
    org: null,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) {
        if (!active) return;
        setState({ loading: false, isPlatformAdmin: false, org: null });
        return;
      }

      const { data: admin } = await supabaseClient
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (admin && active) {
        setState({ loading: false, isPlatformAdmin: true, org: null });
        return;
      }

      const { data: member } = await supabaseClient
        .from("org_members")
        .select("org_id, role, organizations ( id, name, slug, status )")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      const org = normalizeOrg(member?.organizations);

      setState({
        loading: false,
        isPlatformAdmin: false,
        org,
      });
    }

    load();

    return () => {
      active = false;
    };
  }, [user]);

  return state;
}
