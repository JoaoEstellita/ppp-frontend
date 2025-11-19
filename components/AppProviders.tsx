"use client";

import { AuthProvider } from "@/lib/authContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
