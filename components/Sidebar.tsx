"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : null;
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
    { href: "/admin/admins", label: "Admins" },
    { href: "/admin/sindicatos", label: "Sindicatos" },
    { href: "/admin/casos", label: "Casos" },
    { href: "/admin/suporte", label: "Suporte" },
    { href: "/admin/pagamentos", label: "Pagamentos" },
    { href: "/admin/uso", label: "Uso" },
    { href: "/admin/relatorios", label: "Relatorios" },
  ];

  const links = isAdmin ? adminLinks : orgLinks;

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((prev) => !prev)}
        className="md:hidden fixed top-3 left-3 z-50 rounded-md bg-gray-800 text-white px-3 py-2 text-sm"
      >
        Menu
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-black/40"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 text-white p-4 transform transition-transform md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="space-y-2 mt-12 md:mt-0">
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
    </>
  );
}
