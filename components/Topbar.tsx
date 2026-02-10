"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/authContext";
import { getNotifications, markNotificationRead, OrgNotification } from "@/src/services/api";
import { useOrgAccess } from "@/src/hooks/useOrgAccess";

export function Topbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : null;
  const { isPlatformAdmin, org } = useOrgAccess();
  const isAdminArea = pathname?.startsWith("/admin");

  const [notifications, setNotifications] = useState<OrgNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    getNotifications(slug, 20)
      .then((data) => {
        if (active) setNotifications(data);
      })
      .catch(() => {
        if (active) setNotifications([]);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function handleMarkRead(id: string) {
    if (!slug) return;
    try {
      const updated = await markNotificationRead(slug, id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch {
      // ignore
    }
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">PPP Sindicato</h1>
        <div className="flex items-center space-x-4 text-sm text-gray-700 relative">
          {isPlatformAdmin && !isAdminArea && (
            <Button variant="outline" onClick={() => router.push("/admin")}>
              Modo Admin
            </Button>
          )}
          {org?.slug && isAdminArea && (
            <Button variant="outline" onClick={() => router.push(`/s/${org.slug}/dashboard`)}>
              Modo Sindicato
            </Button>
          )}
          {slug && (
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="relative px-2 py-1 rounded-md hover:bg-gray-100"
              aria-label="Notificacoes"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
          {open && (
            <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-md shadow-lg p-3 z-50">
              <div className="text-xs font-semibold text-gray-500 mb-2">Notificacoes</div>
              {notifications.length === 0 && (
                <div className="text-xs text-gray-500">Sem notificacoes recentes.</div>
              )}
              <div className="space-y-2 max-h-64 overflow-auto">
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleMarkRead(item.id)}
                    className={`w-full text-left text-sm p-2 rounded-md border ${
                      item.read_at ? "border-gray-100 text-gray-500" : "border-blue-100"
                    }`}
                  >
                    <div className="font-semibold">{item.title || item.type}</div>
                    {item.body && <div className="text-xs text-gray-600">{item.body}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <span>{user?.email ?? "Usuario autenticado"}</span>
          <Button variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
