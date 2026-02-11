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
  const headerTitle = isAdminArea ? "PPP Admin" : org?.name || "PPP Sindicato";

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
    <header className="border-b border-gray-200 bg-white px-4 py-3 pl-20 shadow-sm sm:px-6 md:pl-6 md:py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="break-words text-2xl font-bold leading-tight text-gray-900 md:text-4xl">
          {headerTitle}
        </h1>
        <div className="relative flex flex-wrap items-center gap-2 text-sm text-gray-700 md:gap-4">
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
              className="relative rounded-md px-2 py-1 hover:bg-gray-100"
              aria-label="Notificacoes"
            >
              Notif.
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-xs text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
          {open && (
            <div className="absolute right-0 top-10 z-50 w-[18rem] rounded-md border border-gray-200 bg-white p-3 shadow-lg sm:w-80">
              <div className="mb-2 text-xs font-semibold text-gray-500">Notificacoes</div>
              {notifications.length === 0 && (
                <div className="text-xs text-gray-500">Sem notificacoes recentes.</div>
              )}
              <div className="max-h-64 space-y-2 overflow-auto">
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleMarkRead(item.id)}
                    className={`w-full rounded-md border p-2 text-left text-sm ${
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
          <span className="max-w-[150px] truncate sm:max-w-[220px] md:max-w-none">
            {user?.email ?? "Usuario autenticado"}
          </span>
          <Button variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
