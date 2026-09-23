import { Info } from "lucide-react";
import { DESCARGO_FISCAL } from "@/lib/fiscal";

/**
 * Descargo obligatorio en todo output fiscal: visible y NO descartable.
 * Deja claro que la app hace SEGUIMIENTO orientativo y nunca emite facturas.
 *
 * Franja, no tarjeta: cruza el ancho del contenido y se lee de una pasada. El
 * texto viene de `DESCARGO_FISCAL` y no se recorta ni se pliega: si no cabe,
 * lo que sobra es lo de al lado.
 */
export function DescargoFiscal({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2.5 rounded-md bg-info-soft px-4 py-2.5 text-[12.5px] leading-relaxed text-ink-2 ${className}`}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
      <span>{DESCARGO_FISCAL}</span>
    </p>
  );
}
