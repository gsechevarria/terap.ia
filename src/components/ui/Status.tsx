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
 * Estado con punto + etiqueta (estilo Linear/Vercel): el color vive en el
 * punto, el texto queda en tinta neutra. `halo` añade un cerco sutil para
 * los estados que piden atención sin llegar a alerta.
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
