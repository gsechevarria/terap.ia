import Link from "next/link";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function PatientPaymentsPage() {
  const { payments, debtCents, packRemaining } = await getMyPaymentSummary();
  const pending = payments.filter((p) => p.status === "pending");

  return (
    <div className="mx-auto max-w-md">
      <Link href="/app" className="text-sm text-ink-3 hover:text-ink">
        ← Inicio
      </Link>
      <h1 className="page-title mt-3">Pagos</h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
            Pendiente de pago
          </div>
          <div className="mt-0.5 text-lg font-semibold">
            {formatCurrency(debtCents)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
            Sesiones de bono
          </div>
          <div className="mt-0.5 text-lg font-semibold">{packRemaining}</div>
        </div>
      </div>

      <h2 className="section-label mt-8 mb-2">Pendiente de pago</h2>
      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">No tienes pagos pendientes.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {pending.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="font-medium">
                {formatCurrency(p.amount_cents, p.currency)}
              </span>
              <span className="text-xs text-ink-3">
                {formatDate(p.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
