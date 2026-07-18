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
        <h1 className="page-title">Pagos</h1>
        <a href="/pro/pagos/export" className="btn-ghost">
          Exportar CSV
        </a>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card px-5 py-4">
          <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
            Cobrado (total)
          </div>
          <div className="mt-0.5 text-xl font-semibold">
            {formatCurrency(totalPaidCents)}
          </div>
        </div>
        <div className="card px-5 py-4">
          <div className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
            Pendiente (deuda)
          </div>
          <div className="mt-0.5 text-xl font-semibold text-warn">
            {formatCurrency(totalPendingCents)}
          </div>
        </div>
      </div>

      <h2 className="section-label mt-10 mb-2">Ingresos por mes</h2>
      {byMonth.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">Sin cobros registrados.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Pagos</th>
                <th className="text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m) => (
                <tr key={m.month} className="last:[&>td]:border-b-0">
                  <td className="capitalize">{monthLabel(m.month)}</td>
                  <td>{m.count}</td>
                  <td className="text-right font-medium">
                    {formatCurrency(m.paidCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-ink-3">
        Export para la gestoría. terap.ia no emite facturas.
      </p>
    </div>
  );
}
