import Link from "next/link";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function PatientPaymentsPage() {
  const { payments, debtCents, packRemaining } = await getMyPaymentSummary();
  const pending = payments.filter((p) => p.status === "pending");

  return (
    <div className="mx-auto max-w-md">
      <Link href="/app" className="text-sm text-neutral-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pagos</h1>

      <div className="mt-5 flex gap-4">
        <div className="flex-1 rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
          <div className="text-xs text-neutral-400">Pendiente de pago</div>
          <div className="text-lg font-semibold">{formatCurrency(debtCents)}</div>
        </div>
        <div className="flex-1 rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
          <div className="text-xs text-neutral-400">Sesiones de bono</div>
          <div className="text-lg font-semibold">{packRemaining}</div>
        </div>
      </div>

      <h2 className="mt-6 text-sm font-semibold text-neutral-500">
        Pendiente de pago
      </h2>
      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">
          No tienes pagos pendientes. 🌿
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {pending.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.12]"
            >
              <span>{formatCurrency(p.amount_cents, p.currency)}</span>
              <span className="text-xs text-neutral-400">
                {formatDate(p.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
