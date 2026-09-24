"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  CalendarDays,
  House,
  Inbox,
  CreditCard,
  Calculator,
  ChartColumnIncreasing,
  Settings,
  Building2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Navegación del panel.
 *
 * Tres grupos separados por una línea y SIN títulos de grupo: el título de un
 * grupo de tres elementos ocupa tanto como un elemento y no dice nada que los
 * propios elementos no digan.
 *
 * Solo hay entradas para pantallas que existen. La maqueta trae además
 * «Mensajes», «Escalas», «Diario emocional», «Tareas», «Alertas» y
 * «Documentos»: en esta aplicación esas cosas viven dentro de la ficha del
 * paciente y no tienen ruta propia, así que ponerlas aquí sería un menú con
 * enlaces muertos. Queda anotado en `docs/DESIGN.md`.
 */
const GRUPOS: { href: string; label: string; Icon: LucideIcon }[][] = [
  [
    { href: "/pro", label: "Hoy", Icon: House },
    { href: "/pro/agenda", label: "Agenda", Icon: CalendarDays },
    { href: "/pro/patients", label: "Pacientes", Icon: Users },
    { href: "/pro/solicitudes", label: "Solicitudes", Icon: Inbox },
  ],
  [
    { href: "/pro/pagos", label: "Pagos", Icon: CreditCard },
    { href: "/pro/contabilidad", label: "Contabilidad", Icon: Calculator },
    { href: "/pro/analitica", label: "Analítica", Icon: ChartColumnIncreasing },
  ],
  [
    { href: "/pro/equipo", label: "Equipo", Icon: Building2 },
    { href: "/pro/ajustes", label: "Ajustes", Icon: Settings },
  ],
];

const ITEMS = GRUPOS.flat();

/**
 * Entrada de la administración de plataforma, en su propio grupo al final.
 * Solo se pinta si el servidor ha dicho que la cuenta administra
 * (`is_platform_admin()`); ocultarla no protege nada —`/admin` lo comprueba por
 * su cuenta—, pero evita tener que escribir la dirección a mano.
 */
const ADMIN = { href: "/admin", label: "Administración", Icon: ShieldCheck };

function isActive(pathname: string, href: string): boolean {
  // `/pro` es ahora «Hoy», una pantalla concreta, así que su coincidencia es
  // exacta: antes era el listado de pacientes y se daba por activa también en
  // `/pro/patients`, que ya tiene entrada propia.
  return href === "/pro" ? pathname === "/pro" : pathname.startsWith(href);
}

/**
 * Trabajo pendiente de decidir. Va en el acento y en negrita, no en una
 * pastilla roja: una solicitud de cita sin contestar es una tarea, no un
 * riesgo, y el rojo está reservado a lo clínico.
 */
function Pendientes({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto text-[12.5px] font-semibold text-accent"
      aria-label={`${count} sin responder`}
    >
      {count} {count === 1 ? "nueva" : "nuevas"}
    </span>
  );
}

/** Recuento neutro (expedientes activos): dato, no aviso. */
function Recuento({ value }: { value: number }) {
  if (value <= 0) return null;
  return <span className="mono ml-auto text-[12.5px] text-ink-4">{value}</span>;
}

function claseEnlace(active: boolean): string {
  return `flex h-9 items-center gap-[11px] rounded-lg px-2.5 text-[14px] transition-colors duration-150 ${
    active
      ? "bg-surface font-semibold text-ink"
      : "text-ink-2 hover:bg-surface/60 hover:text-ink"
  }`;
}

/** Navegación lateral del panel, estado activo por ruta. */
export function ProNav({
  pendingRequests = 0,
  patientCount = 0,
  esAdmin = false,
}: {
  pendingRequests?: number;
  patientCount?: number;
  esAdmin?: boolean;
}) {
  const pathname = usePathname();
  const grupos = esAdmin ? [...GRUPOS, [ADMIN]] : GRUPOS;
  return (
    <nav className="flex flex-col gap-0.5 text-[14px]">
      {grupos.map((grupo, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {i > 0 && <div className="mx-2.5 my-3 h-px bg-line-strong" aria-hidden />}
          {grupo.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={claseEnlace(active)}
              >
                <Icon
                  size={17}
                  strokeWidth={1.7}
                  className={`shrink-0 ${active ? "text-accent" : ""}`}
                  aria-hidden
                />
                {label}
                {href === "/pro/solicitudes" && <Pendientes count={pendingRequests} />}
                {href === "/pro/patients" && <Recuento value={patientCount} />}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Navegación compacta horizontal para móvil (desplazamiento lateral). */
export function ProNavMobile({
  pendingRequests = 0,
}: {
  pendingRequests?: number;
}) {
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
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13.5px] transition-colors duration-150 ${
              active
                ? "bg-surface font-semibold text-ink"
                : "text-ink-2 hover:bg-surface hover:text-ink"
            }`}
          >
            <Icon
              size={18}
              strokeWidth={1.7}
              className={`shrink-0 ${active ? "text-accent" : ""}`}
              aria-hidden
            />
            {label}
            {href === "/pro/solicitudes" && <Pendientes count={pendingRequests} />}
          </Link>
        );
      })}
    </nav>
  );
}
