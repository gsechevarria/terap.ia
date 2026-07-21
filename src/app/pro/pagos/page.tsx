import Link from "next/link";
import type { ReactNode } from "react";
import { getProfessionalPayments } from "@/lib/queries/payments";
import { formatCurrency } from "@/lib/format";
import { BarChart } from "@/app/pro/_components/BarChart";
import { MethodBreakdown } from "@/app/pro/_components/MethodBreakdown";
import { presetRange } from "@/lib/date-ranges";

function monthLabelLong(ym: string): string {
  return new Date(`${ym}-01T00:00:00`).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}
function monthLabelShort(ym: string): string {
  return new Date(`${ym}-01T00:00:00`).toLocaleDateString("es-ES", {
    month: "short",
    year: "2-digit",
  });
}
/** Rango inclusivo YYYY-MM-DD de un mes (fecha pura, apta para render). */
function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const p = (n: number) => String(n).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${p(last)}` };
}

export default async function PaymentsOverviewPage() {
  const history = await getProfessionalPayments();

  // "Hoy" fuera del JSX (regla de pureza): mes en curso + su rango.
  const now = new Date();
  const thisRange = presetRange("this-month", now);
  const thisMonthKey = thisRange.from.slice(0, 7); // YYYY-MM
  const thisMonthPaid =
    history.byMonth.find((m) => m.month === thisMonthKey)?.paidCents ?? 0;
  const debtors = new Set(
    history.rows.filter((r) => r.status === "pending").map((r) => r.patient_id),
  ).size;

  const monthHref = (ym: string) => {
    const r = monthRange(ym);
    return `/pro/pagos/historico?status=paid&from=${r.from}&to=${r.to}`;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title">Pagos</h1>
        <div className="flex items-center gap-2">
          <Link href="/pro/pagos/historico" className="btn-ghost">
            Ver histórico
          </Link>
          <a href="/pro/pagos/export" className="btn-ghost">
            Exportar CSV
          </a>
        </div>
      </div>

      {/* Tiles clicables → histórico filtrado */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TileLink
          href="/pro/pagos/historico?status=paid"
          label="Cobrado (total)"
        >
          {formatCurrency(history.totalPaidCents)}
        </TileLink>
        <TileLink
          href="/pro/pagos/historico?status=pending"
          label="Pendiente (deuda)"
          tone="warn"
        >
          {formatCurrency(history.totalPendingCents)}
        </TileLink>
        <TileLink
          href={`/pro/pagos/historico?status=paid&from=${thisRange.from}&to=${thisRange.to}`}
          label="Cobrado este mes"
        >
          {formatCurrency(thisMonthPaid)}
        </TileLink>
        <TileLink
          href="/pro/pagos/historico?status=pending"
          label="Pacientes con deuda"
        >
          {debtors}
        </TileLink>
      </div>

      {/* Analítica */}
      {history.byMonth.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <section className="card p-4 md:col-span-3">
            <h2 className="section-label mb-3">Ingresos por mes</h2>
            <BarChart
              ariaLabel="Ingresos por mes"
              valueLabel={(n) => formatCurrency(n)}
              data={[...history.byMonth]
                .reverse()
                .map((m) => ({
                  label: monthLabelShort(m.month),
                  value: m.paidCents,
                }))}
            />
          </section>
          <section className="card p-4 md:col-span-2">
            <h2 className="section-label mb-3">Cobrado por método</h2>
            <MethodBreakdown rows={history.byMethod} />
          </section>
        </div>
      )}

      <h2 className="section-label mt-10 mb-2">Detalle por mes</h2>
      {history.byMonth.length === 0 ? (
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
              {history.byMonth.map((m) => (
                <tr key={m.month} className="row-hover last:[&>td]:border-b-0">
                  <td className="capitalize">
                    <Link href={monthHref(m.month)} className="hover:underline">
                      {monthLabelLong(m.month)}
                    </Link>
                  </td>
                  <td>{m.count}</td>
                  <td className="text-right font-medium tabular-nums">
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

function TileLink({
  href,
  label,
  tone,
  children,
}: {
  href: string;
  label: string;
  tone?: "warn";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="card group px-4 py-3 transition-colors hover:border-line-strong hover:bg-wash"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
          {label}
        </span>
        <span className="text-ink-3 opacity-0 transition-opacity group-hover:opacity-100">
          →
        </span>
      </div>
      <div
        className={`mt-0.5 text-xl font-semibold tracking-[-0.01em] ${
          tone === "warn" ? "text-warn" : ""
        }`}
      >
        {children}
      </div>
    </Link>
  );
}
