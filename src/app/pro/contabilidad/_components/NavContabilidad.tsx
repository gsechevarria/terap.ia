"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Pestañas del módulo de contabilidad. Sustituyen a los cinco botones que la
 * pantalla principal apilaba en su cabecera y al «← Contabilidad» con el que
 * cada subpantalla volvía atrás: con ellas, todas las pantallas del módulo se
 * alcanzan desde cualquiera y se ve en cuál se está.
 *
 * Va debajo del título de cada pantalla, no en un `layout`, para que el `h1`
 * siga siendo lo primero del documento, como en «Hoy».
 */
export function NavContabilidad({ ejercicio }: { ejercicio: number }) {
  const ruta = usePathname();
  const base = "/pro/contabilidad";
  const pestañas = [
    { href: base, label: "Resumen", activa: ruta === base },
    { href: `${base}/gastos`, label: "Gastos", activa: ruta.startsWith(`${base}/gastos`) },
    { href: `${base}/revision`, label: "Revisión", activa: ruta.startsWith(`${base}/revision`) },
    {
      href: `${base}/expediente/${ejercicio}`,
      label: "Expediente anual",
      activa: ruta.startsWith(`${base}/expediente`),
    },
    { href: `${base}/exportar`, label: "Exportar", activa: ruta.startsWith(`${base}/exportar`) },
    {
      href: `${base}/configuracion`,
      label: "Configuración",
      activa: ruta.startsWith(`${base}/configuracion`),
    },
  ];

  return (
    <nav aria-label="Secciones de contabilidad" className="tabs">
      {pestañas.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.activa ? "page" : undefined}
          className={`tab${p.activa ? " tab-active" : ""}`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
