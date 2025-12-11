"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";

export type SubscriptionStatus = "inactive" | "active" | "canceled" | string;

export interface Subscription {
  id: string;
  user_id: string;
  email?: string | null;
  plan?: string | null;
  status: SubscriptionStatus;
  current_period_start?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface UseSubscriptionState {
  loading: boolean;
  active: boolean;
  subscription: Subscription | null;
  error?: string | null;
}

export function useSubscription(): UseSubscriptionState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<UseSubscriptionState>({
    loading: !authLoading,
    active: false,
    subscription: null,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    if (authLoading) return;
    if (!user) {
      if (isMounted) {
        setState({ loading: false, active: false, subscription: null, error: null });
      }
      return;
    }

    const fetchSubscription = async () => {
      try {
        if (isMounted) {
          setState((prev) => ({ ...prev, loading: true, error: null }));
        }
        const { data, error } = await supabaseClient
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const sub = (data as Subscription | null) ?? null;
        const active =
          sub?.status === "active" &&
          (!sub.current_period_end ||
            new Date(sub.current_period_end).getTime() >= Date.now());

        if (isMounted) {
          setState({ loading: false, active, subscription: sub, error: null });
        }
      } catch (err: any) {
        if (isMounted) {
          setState({
            loading: false,
            active: false,
            subscription: null,
            error: err?.message || "Erro ao buscar assinatura",
          });
        }
      }
    };

    fetchSubscription();

    return () => {
      isMounted = false;
    };
  }, [authLoading, user]);

  return state;
}
