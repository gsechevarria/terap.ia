"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/pro", label: "Pacientes" },
  { href: "/pro/agenda", label: "Agenda" },
  { href: "/pro/pagos", label: "Pagos" },
  { href: "/pro/analitica", label: "Analítica" },
  { href: "/pro/ajustes", label: "Ajustes" },
];

/** Navegación del panel con estado activo por ruta (estilo Notion). */
export function ProNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
      {ITEMS.map(({ href, label }) => {
        const active =
          href === "/pro"
            ? pathname === "/pro" || pathname.startsWith("/pro/patients")
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded px-2.5 py-1 text-sm transition-colors duration-100 ${
              active
                ? "bg-wash-2 font-medium text-ink"
                : "text-ink-2 hover:bg-wash hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
