"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  CalendarDays,
  CreditCard,
  ChartColumnIncreasing,
  Settings,
  type LucideIcon,
} from "lucide-react";

const ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/pro", label: "Pacientes", Icon: Users },
  { href: "/pro/agenda", label: "Agenda", Icon: CalendarDays },
  { href: "/pro/pagos", label: "Pagos", Icon: CreditCard },
  { href: "/pro/analitica", label: "Analítica", Icon: ChartColumnIncreasing },
  { href: "/pro/ajustes", label: "Ajustes", Icon: Settings },
];

/** Navegación del panel con estado activo por ruta (estilo Notion). */
export function ProNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
      {ITEMS.map(({ href, label, Icon }) => {
        const active =
          href === "/pro"
            ? pathname === "/pro" || pathname.startsWith("/pro/patients")
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition-colors duration-150 ${
              active
                ? "bg-wash-2 font-medium text-ink"
                : "text-ink-2 hover:bg-wash hover:text-ink"
            }`}
          >
            <Icon className="size-4" strokeWidth={2} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
