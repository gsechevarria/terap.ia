import { formatCurrency } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { MethodBreakdown as MethodBreakdownRow } from "@/lib/queries/payments";

function methodName(method: string): string {
  return method === "none" ? "Sin especificar" : paymentMethodLabel(method);
}

/**
 * Reparto del cobrado por método de pago (barras horizontales, tema-aware).
 * Solo descriptivo: no interpreta ni factura.
 */
export function MethodBreakdown({ rows }: { rows: MethodBreakdownRow[] }) {
  const total = rows.reduce((s, r) => s + r.paidCents, 0);
  if (total === 0) {
    return <p className="text-sm text-ink-2">Sin cobros registrados.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const pct = Math.round((r.paidCents / total) * 100);
        return (
          <li key={r.method}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{methodName(r.method)}</span>
              <span className="tabular-nums text-ink-2">
                {formatCurrency(r.paidCents)}
                <span className="ml-1.5 text-ink-3">{pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
