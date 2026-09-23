import Link from "next/link";
import { getProfessionalPayments } from "@/lib/queries/payments";
import { formatCurrency } from "@/lib/format";
import { BarChart } from "@/app/pro/_components/BarChart";
import { MethodBreakdown } from "@/app/pro/_components/MethodBreakdown";
import { presetRange } from "@/lib/date-ranges";
import { ymdParts } from "@/lib/tz";

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
  const [y, m] = ymdParts(`${ym}-01`);
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
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {/* Las cuatro cifras, sin caja: separadas por espacio, no por bordes. */}
      <section className="grid grid-cols-1 gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <CifraEnlace
          href="/pro/pagos/historico?status=paid"
          rotulo="Cobrado en total"
          valor={formatCurrency(history.totalPaidCents)}
          pie={`${history.paidCount} ${history.paidCount === 1 ? "pago" : "pagos"}`}
        />
        <CifraEnlace
          href="/pro/pagos/historico?status=pending"
          rotulo="Pendiente de cobro"
          valor={formatCurrency(history.totalPendingCents)}
          pie={`${history.pendingCount} ${history.pendingCount === 1 ? "pago" : "pagos"} sin cobrar`}
        />
        <CifraEnlace
          href={`/pro/pagos/historico?status=paid&from=${thisRange.from}&to=${thisRange.to}`}
          rotulo="Cobrado este mes"
          valor={formatCurrency(thisMonthPaid)}
          pie={`en ${monthLabelLong(thisMonthKey)}`}
        />
        <CifraEnlace
          href="/pro/pagos/historico?status=pending"
          rotulo="Pacientes con deuda"
          valor={String(debtors)}
          pie="con algún pago pendiente"
        />
      </section>

      {history.byMonth.length > 0 && (
        <div className="flex flex-col gap-8 border-t border-line pt-[22px] lg:flex-row">
          <section className="min-w-0 flex-1">
            <h2 className="section-title">Ingresos por mes</h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              Solo lo que consta como cobrado.
            </p>
            <div className="mt-4">
              <BarChart
                ariaLabel="Ingresos por mes"
                valueLabel={(n) => formatCurrency(n)}
                data={[...history.byMonth].reverse().map((m) => ({
                  label: monthLabelShort(m.month),
                  value: m.paidCents,
                }))}
              />
            </div>
          </section>
          <section className="w-full lg:w-[300px] lg:shrink-0">
            <h2 className="section-title">Cobrado por método</h2>
            <div className="mt-4">
              <MethodBreakdown rows={history.byMethod} />
            </div>
          </section>
        </div>
      )}

      <section className="border-t border-line pt-[22px]">
        <h2 className="section-title">Detalle por mes</h2>
        {history.byMonth.length === 0 ? (
          <p className="py-3 text-[13.5px] text-ink-3">
            Todavía no hay ningún cobro registrado. Los pagos se anotan desde la
            ficha del paciente, en la pestaña Pagos.
          </p>
        ) : (
          <div className="table-wrap mt-3 overflow-x-auto">
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
                  <tr key={m.month} className="row-hover">
                    <td className="capitalize">
                      <Link
                        href={monthHref(m.month)}
                        className="font-medium hover:text-accent"
                      >
                        {monthLabelLong(m.month)}
                      </Link>
                    </td>
                    <td className="text-ink-2">{m.count}</td>
                    <td className="mono text-right font-medium">
                      {formatCurrency(m.paidCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[12.5px] text-ink-4">
        Export para la gestoría. terap.ia no emite facturas.
      </p>
    </div>
  );
}

/**
 * Cifra sin caja: rótulo, número y pie. Sigue siendo un enlace al histórico ya
 * filtrado —quitarle la tarjeta no la convierte en texto muerto—, y el foco se
 * ve por el contorno de `:focus-visible` del sistema.
 */
function CifraEnlace({
  href,
  rotulo,
  valor,
  pie,
}: {
  href: string;
  rotulo: string;
  valor: string;
  pie: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className="text-[13px] text-ink-3">{rotulo}</div>
      <div className="figure mt-1 group-hover:text-accent">{valor}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-2">{pie}</div>
    </Link>
  );
}
