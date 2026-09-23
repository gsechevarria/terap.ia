import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

export type StatusTone =
  | "neutral"
  | "accent"
  | "success"
  | "info"
  | "warn"
  | "danger";

/**
 * Estado: punto de color y etiqueta, sin caja.
 *
 * El relleno se reserva a los contadores y a lo crítico, así que una tabla con
 * diez filas de estado no acaba siendo diez pastillas de colores compitiendo
 * entre sí. El color va SOLO en el punto y el texto se queda en tinta neutra:
 * el color nunca es el único portador, la palabra está siempre al lado.
 *
 * `halo` añade un cerco al punto para lo que pide atención sin llegar a alerta.
 */
export function Status({
  tone = "neutral",
  halo = false,
  children,
}: {
  tone?: StatusTone;
  halo?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="st">
      <span className={`dot d-${tone}${halo ? " halo" : ""}`} />
      {children}
    </span>
  );
}

/**
 * Estado crítico en sólido — reservado a alertas clínicas que deben destacar
 * (p. ej. ítem 9 del PHQ-9). Es el único estado con relleno en toda la app.
 */
export function StatusCritical({ children }: { children: ReactNode }) {
  return (
    <span className="st-solid">
      <TriangleAlert className="size-3" strokeWidth={2.5} aria-hidden />
      {children}
    </span>
  );
}
