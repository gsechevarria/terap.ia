"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CalendarDays,
  HeartPulse,
  BookOpen,
  Menu,
  type LucideIcon,
} from "lucide-react";

const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/app", label: "Inicio", Icon: House },
  { href: "/app/appointments", label: "Citas", Icon: CalendarDays },
  { href: "/app/diary", label: "Diario", Icon: HeartPulse },
  { href: "/app/resources", label: "Recursos", Icon: BookOpen },
  { href: "/app/more", label: "Más", Icon: Menu },
];

function isActive(pathname: string, href: string): boolean {
  // "/app" solo se marca en la home; si no, estaría activa en todas las rutas.
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

/**
 * Barra de pestañas inferior, el patrón que espera cualquiera que abra esto en
 * el móvil. Fija abajo y respetando el área segura de iOS (la franja del
 * indicador de inicio), que si no se come la fila de iconos.
 */
export function AppTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-1 py-2 text-[11px] transition-colors duration-150 ${
                  active ? "text-accent" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                <Icon
                  className="size-5"
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden
                />
                <span className={active ? "font-medium" : ""}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
