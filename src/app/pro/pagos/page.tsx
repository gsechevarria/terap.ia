import { getPaymentsOverview } from "@/lib/queries/payments";
import { formatCurrency } from "@/lib/format";

function monthLabel(ym: string): string {
  const d = new Date(`${ym}-01T00:00:00`);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

export default async function PaymentsOverviewPage() {
  const { byMonth, totalPaidCents, totalPendingCents } =
    await getPaymentsOverview();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pagos</h1>
        <a
          href="/pro/pagos/export"
          className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
        >
          Exportar CSV
        </a>
      </div>

      <div className="mt-5 flex flex-wrap gap-4">
        <div className="rounded-xl border border-black/[.08] px-5 py-3 dark:border-white/[.12]">
          <div className="text-xs text-neutral-400">Cobrado (total)</div>
          <div className="text-lg font-semibold">
            {formatCurrency(totalPaidCents)}
          </div>
        </div>
        <div className="rounded-xl border border-black/[.08] px-5 py-3 dark:border-white/[.12]">
          <div className="text-xs text-neutral-400">Pendiente (deuda)</div>
          <div className="text-lg font-semibold text-amber-600">
            {formatCurrency(totalPendingCents)}
          </div>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-500">
        Ingresos por mes
      </h2>
      {byMonth.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Sin cobros registrados.</p>
      ) : (
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/[.08] text-left text-neutral-500 dark:border-white/[.12]">
              <th className="py-2 font-medium">Mes</th>
              <th className="py-2 font-medium">Pagos</th>
              <th className="py-2 text-right font-medium">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {byMonth.map((m) => (
              <tr
                key={m.month}
                className="border-b border-black/[.05] dark:border-white/[.08]"
              >
                <td className="py-2 capitalize">{monthLabel(m.month)}</td>
                <td className="py-2">{m.count}</td>
                <td className="py-2 text-right font-medium">
                  {formatCurrency(m.paidCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-6 text-xs text-neutral-400">
        Export para la gestoría. terap.ia no emite facturas.
      </p>
    </div>
  );
}
