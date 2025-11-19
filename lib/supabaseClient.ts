"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let warningShown = false;

function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!warningShown) {
      console.error("Supabase URL/Anon key nao configurados");
      warningShown = true;
    }
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export function getSupabaseClient() {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

export const supabaseClient = getSupabaseClient();
