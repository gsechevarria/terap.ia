import Link from "next/link";
import { getProfessionalPayments } from "@/lib/queries/payments";
import { formatCurrency } from "@/lib/format";
import {
  IngresosPorMes,
  type MesDeIngresos,
} from "@/app/pro/_components/IngresosPorMes";
import { MethodBreakdown } from "@/app/pro/_components/MethodBreakdown";
import { presetRange } from "@/lib/date-ranges";
import { ymdParts } from "@/lib/tz";

/*
 * Los meses son fechas sin zona: se anclan a mediodía UTC y se formatean en UTC
 * para que ni el servidor ni el navegador los muevan al mes de al lado.
 */
function mesComoFecha(ym: string): Date {
  const [y, m] = ymdParts(`${ym}-01`);
  return new Date(Date.UTC(y, m - 1, 1, 12));
}
/** «septiembre de 2026». */
function monthLabelLong(ym: string): string {
  return mesComoFecha(ym).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}
/** «Septiembre de 2026». `capitalize` en CSS daba «Septiembre De 2026». */
function monthLabelTitle(ym: string): string {
  const t = monthLabelLong(ym);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/** «sept», y con el año en enero para que se vea dónde cambia. */
function monthLabelShort(ym: string, primero: boolean): string {
  const d = mesComoFecha(ym);
  const mes = d.toLocaleDateString("es-ES", { timeZone: "UTC", month: "short" });
  return primero || ym.endsWith("-01") ? `${mes} ${String(d.getUTCFullYear()).slice(2)}` : mes;
}
function addMonths(ym: string, n: number): string {
  const [y, m] = ymdParts(`${ym}-01`);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** Meses mostrados en la gráfica: como mucho 12, como poco 6. */
const MESES_MAX = 12;
const MESES_MIN = 6;
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

  // Serie continua que acaba en el mes en curso. Arranca en el primer mes con
  // cobros si es más reciente que hace un año, sin bajar de seis columnas: con
  // dos barras solas, cada una ocupaba media hoja.
  const primero = history.byMonth.at(-1)?.month ?? thisMonthKey;
  let desde = addMonths(thisMonthKey, -(MESES_MAX - 1));
  if (primero > desde) desde = primero;
  if (desde > addMonths(thisMonthKey, -(MESES_MIN - 1))) {
    desde = addMonths(thisMonthKey, -(MESES_MIN - 1));
  }
  const cobradoPorMes = new Map(history.byMonth.map((m) => [m.month, m.paidCents]));
  const serie: MesDeIngresos[] = [];
  for (let ym = desde; ym <= thisMonthKey; ym = addMonths(ym, 1)) {
    serie.push({
      mes: ym,
      etiqueta: monthLabelShort(ym, serie.length === 0),
      cents: cobradoPorMes.get(ym) ?? 0,
      esMesEnCurso: ym === thisMonthKey,
      href: monthHref(ym),
    });
  }
  const fueraDeLaGrafica = history.byMonth.filter((m) => m.month < desde).length;

  const mesEnCurso = monthLabelLong(thisMonthKey).split(" de ")[0];
  const frase = [
    thisMonthPaid > 0
      ? `En ${mesEnCurso} llevas ${formatCurrency(thisMonthPaid)} cobrados.`
      : `En ${mesEnCurso} todavía no consta ningún cobro.`,
    history.totalPendingCents > 0
      ? `Quedan ${formatCurrency(history.totalPendingCents)} pendientes, de ${debtors} ${debtors === 1 ? "paciente" : "pacientes"}.`
      : "No hay nada pendiente de cobro.",
  ].join(" ");

  return (
    <div className="flex flex-col gap-[22px]">
      {/* Cabecera como la de «Hoy» y «Pacientes»: título, la frase que dice en
          una línea cómo va el mes, y las acciones a la derecha. */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">Pagos</h1>
          <p className="mt-3 max-w-[560px] text-body-lg text-ink-2">{frase}</p>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Link href="/pro/pagos/historico" className="btn-ghost">
            Ver histórico
          </Link>
          <a href="/pro/pagos/export" className="btn-ghost">
            Exportar CSV
          </a>
        </div>
      </header>

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
            <div className="mb-4">
              <h2 className="section-title">Ingresos por mes</h2>
              <p className="mt-0.5 text-[13px] text-ink-3">
                Solo lo que consta como cobrado, en los últimos {serie.length} meses.
                {fueraDeLaGrafica > 0 &&
                  ` Los ${fueraDeLaGrafica} anteriores están en el detalle de abajo.`}
              </p>
            </div>
            <IngresosPorMes meses={serie} />
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
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="section-title">
            Detalle por mes{" "}
            <span className="font-normal text-ink-4">
              {history.byMonth.length} {history.byMonth.length === 1 ? "mes" : "meses"} con cobros
            </span>
          </h2>
          <Link href="/pro/pagos/historico" className="text-[13px] text-accent hover:underline">
            Ver cada pago
          </Link>
        </div>
        {history.byMonth.length === 0 ? (
          <p className="py-3 text-[13.5px] text-ink-3">
            Todavía no hay ningún cobro registrado. Los pagos se anotan desde la
            ficha del paciente, en la pestaña Pagos.
          </p>
        ) : (
          /* Sin caja, con las líneas de las tablas de «Hoy»: `--line` bajo la
             cabecera y `--line-soft` entre filas. */
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr>
                  <th className="w-full border-b border-line py-2 text-left text-[12.5px] font-normal text-ink-3">
                    Mes
                  </th>
                  <th className="border-b border-line py-2 pr-8 text-right text-[12.5px] font-normal whitespace-nowrap text-ink-3">
                    Pagos cobrados
                  </th>
                  <th className="border-b border-line py-2 text-right text-[12.5px] font-normal text-ink-3">
                    Ingresos
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.byMonth.map((m) => {
                  const linea = { borderBottom: "1px solid var(--line-soft)" };
                  return (
                    <tr key={m.month} className="row-hover">
                      <td className="py-2.5 whitespace-nowrap" style={linea}>
                        <Link
                          href={monthHref(m.month)}
                          className="font-medium hover:text-accent"
                        >
                          {monthLabelTitle(m.month)}
                        </Link>
                        {m.month === thisMonthKey && (
                          <span className="ml-2 text-[12.5px] text-ink-3">en curso</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-8 text-right text-ink-2" style={linea}>
                        {m.count}
                      </td>
                      <td
                        className="py-2.5 text-right font-semibold whitespace-nowrap"
                        style={linea}
                      >
                        {formatCurrency(m.paidCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[12.5px] text-ink-4">
        Export para la gestoría. Terap no emite facturas.
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
