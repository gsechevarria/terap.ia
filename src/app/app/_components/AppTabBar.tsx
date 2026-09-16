"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CalendarDays,
  NotebookText,
  BookOpen,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

const TABS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/app", label: "Inicio", Icon: House },
  { href: "/app/appointments", label: "Citas", Icon: CalendarDays },
  { href: "/app/diary", label: "Diario", Icon: NotebookText },
  { href: "/app/resources", label: "Recursos", Icon: BookOpen },
  { href: "/app/more", label: "Más", Icon: MoreHorizontal },
];

function isActive(pathname: string, href: string): boolean {
  // "/app" solo se marca en la home; si no, estaría activa en todas las rutas.
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

/**
 * Navegación inferior: el patrón que espera cualquiera que abra esto en un
 * teléfono. Estable (no desplaza con el contenido) y respetando el área segura
 * de iOS, que si no se come la fila de iconos.
 *
 * El estado activo no depende solo del color: cambia el relleno del icono, el
 * peso de la etiqueta y lleva `aria-current="page"`, que es además el selector
 * del que cuelga el estilo.
 */
export function AppTabBar() {
  const pathname = usePathname();

  return (
    <nav className="tp-nav" aria-label="Secciones">
      <div className="tp-nav-inner">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
            >
              <span className="tp-nav-icon">
                <Icon size={21} strokeWidth={active ? 1.9 : 1.6} aria-hidden />
              </span>
              <b>{label}</b>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
