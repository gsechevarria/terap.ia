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

function isActive(pathname: string, href: string): boolean {
  return href === "/pro"
    ? pathname === "/pro" || pathname.startsWith("/pro/patients")
    : pathname.startsWith(href);
}

/** Navegación lateral del panel (sidebar), estado activo por ruta. */
export function ProNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ${
              active
                ? "bg-wash-2 font-medium text-ink"
                : "text-ink-2 hover:bg-wash hover:text-ink"
            }`}
          >
            <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Navegación compacta horizontal para móvil (scroll-x). */
export function ProNavMobile() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ${
              active
                ? "bg-wash-2 font-medium text-ink"
                : "text-ink-2 hover:bg-wash hover:text-ink"
            }`}
          >
            <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
