"use client";

import { AuthProvider } from "@/lib/authContext";
import { ServerWarmupBanner } from "./ServerWarmupBanner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ServerWarmupBanner />
      {children}
    </AuthProvider>
  );
}
