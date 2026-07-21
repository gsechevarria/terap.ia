import { Info } from "lucide-react";
import { DESCARGO_FISCAL } from "@/lib/fiscal";

/**
 * Descargo obligatorio en todo output fiscal: visible y NO descartable.
 * Deja claro que la app hace SEGUIMIENTO orientativo y nunca emite facturas.
 */
export function DescargoFiscal({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink-2 ${className}`}
    >
      <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
      <span>{DESCARGO_FISCAL}</span>
    </p>
  );
}
