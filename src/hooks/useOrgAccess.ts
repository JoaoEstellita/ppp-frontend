import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";

export type OrgAccess = {
  loading: boolean;
  isPlatformAdmin: boolean;
  org: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
};

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

      setState({
        loading: false,
        isPlatformAdmin: false,
        org: (member?.organizations as OrgAccess["org"]) ?? null,
      });
    }

    load();

    return () => {
      active = false;
    };
  }, [user]);

  return state;
}

