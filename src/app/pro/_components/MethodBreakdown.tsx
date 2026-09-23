import { formatCurrency } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { MethodBreakdown as MethodBreakdownRow } from "@/lib/queries/payments";

function methodName(method: string): string {
  return method === "none" ? "Sin especificar" : paymentMethodLabel(method);
}

/**
 * Escala secuencial de un solo tono: el verde codifica CANTIDAD, no bien ni
 * mal. Las filas llegan ordenadas de mayor a menor importe cobrado, así que el
 * tono decrece con el importe. Se corta en `--green-2` porque `--green-1` es
 * casi el fondo y una barra que no se ve no informa de nada.
 */
const ESCALA = [
  "var(--green-5)",
  "var(--green-4)",
  "var(--green-3)",
  "var(--green-2)",
];

/**
 * Reparto del cobrado por método de pago (barras horizontales, tema-aware).
 * Solo descriptivo: no interpreta ni factura.
 *
 * El importe y el porcentaje van SIEMPRE escritos al lado de la barra: el
 * color no puede ser el único portador de la información.
 */
export function MethodBreakdown({ rows }: { rows: MethodBreakdownRow[] }) {
  const total = rows.reduce((s, r) => s + r.paidCents, 0);
  if (total === 0) {
    return (
      <p className="py-3 text-[13.5px] text-ink-3">
        Todavía no hay ningún cobro registrado.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((r, i) => {
        const pct = Math.round((r.paidCents / total) * 100);
        return (
          <li key={r.method}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] font-medium text-ink">
                {methodName(r.method)}
              </span>
              <span className="mono text-[13px] text-ink-2">
                {formatCurrency(r.paidCents)}
                <span className="ml-2 text-ink-4">{pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-surface-muted">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  background: ESCALA[Math.min(i, ESCALA.length - 1)] ?? "var(--green-2)",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
