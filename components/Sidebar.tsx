"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : null;
  const isAdmin = pathname?.startsWith("/admin");

  const orgLinks = slug
    ? [
        { href: `/s/${slug}/dashboard`, label: "Dashboard" },
        { href: `/s/${slug}/kanban`, label: "Kanban" },
        { href: `/s/${slug}/casos`, label: "Casos" },
        { href: `/s/${slug}/casos/novo`, label: "Novo caso" },
        { href: `/s/${slug}/trabalhadores`, label: "Trabalhadores" },
        { href: `/s/${slug}/relatorios`, label: "Relatorios" },
      ]
    : [];

  const adminLinks = [
    { href: "/admin/sindicatos", label: "Sindicatos" },
    { href: "/admin/pagamentos", label: "Pagamentos" },
    { href: "/admin/uso", label: "Uso" },
    { href: "/admin/relatorios", label: "Relatorios" },
  ];

  const links = isAdmin ? adminLinks : orgLinks;

  return (
    <aside className="w-64 bg-gray-800 text-white min-h-screen p-4">
      <nav className="space-y-2">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-4 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

