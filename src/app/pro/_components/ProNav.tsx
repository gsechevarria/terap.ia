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
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] leading-none font-semibold text-accent-ink"
      aria-label={`${count} pendiente${count === 1 ? "" : "s"}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Recuento neutro (p. ej. expedientes activos): dato, no aviso. */
function Recuento({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="mono ml-auto rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
      {value}
    </span>
  );
}

/** Navegación lateral del panel (sidebar), estado activo por ruta. */
export function ProNav({
  pendingRequests = 0,
  patientCount = 0,
}: {
  pendingRequests?: number;
  patientCount?: number;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150 ${
              active
                ? "bg-surface-2 font-medium text-accent"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon size={18} strokeWidth={1.75} className="shrink-0" aria-hidden />
            {label}
            {href === "/pro/solicitudes" && <Badge count={pendingRequests} />}
            {href === "/pro" && <Recuento value={patientCount} />}
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
    <nav className="flex items-center gap-1 overflow-x-auto">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150 ${
              active
                ? "bg-surface-2 font-medium text-accent"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon size={20} strokeWidth={1.75} className="shrink-0" aria-hidden />
            {label}
            {href === "/pro/solicitudes" && <Badge count={pendingRequests} />}
          </Link>
        );
      })}
    </nav>
  );
}
