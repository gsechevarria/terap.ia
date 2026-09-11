"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  CalendarDays,
  Inbox,
  CreditCard,
  Calculator,
  ChartColumnIncreasing,
  Settings,
  type LucideIcon,
} from "lucide-react";

const ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/pro", label: "Pacientes", Icon: Users },
  { href: "/pro/agenda", label: "Agenda", Icon: CalendarDays },
  { href: "/pro/solicitudes", label: "Solicitudes", Icon: Inbox },
  { href: "/pro/pagos", label: "Pagos", Icon: CreditCard },
  { href: "/pro/contabilidad", label: "Contabilidad", Icon: Calculator },
  { href: "/pro/analitica", label: "Analítica", Icon: ChartColumnIncreasing },
  { href: "/pro/ajustes", label: "Ajustes", Icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/pro"
    ? pathname === "/pro" || pathname.startsWith("/pro/patients")
    : pathname.startsWith(href);
}

/** Contador de solicitudes por decidir. Se oculta en cuanto no queda ninguna. */
function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
      aria-label={`${count} pendiente${count === 1 ? "" : "s"}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Navegación lateral del panel (sidebar), estado activo por ruta. */
export function ProNav({ pendingRequests = 0 }: { pendingRequests?: number }) {
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
            {href === "/pro/solicitudes" && <Badge count={pendingRequests} />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Navegación compacta horizontal para móvil (scroll-x). */
export function ProNavMobile({
  pendingRequests = 0,
}: { pendingRequests?: number }) {
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
            {href === "/pro/solicitudes" && <Badge count={pendingRequests} />}
          </Link>
        );
      })}
    </nav>
  );
}
