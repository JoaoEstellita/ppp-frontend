"use client";

import { Button } from "@/components/Button";
import { useAuth } from "@/lib/authContext";

export function Topbar() {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Auditoria de PPP</h1>
        <div className="flex items-center space-x-4 text-sm text-gray-700">
          <span>{user?.email ?? "Usuario autenticado"}</span>
          <Button variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
