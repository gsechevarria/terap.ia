import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getProfessionalPayments,
  PAYMENT_METHOD_FILTERS,
} from "@/lib/queries/payments";
import { getPatientsForSelect } from "@/lib/queries/appointments";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { Status } from "@/components/ui/Status";
import { BarChart } from "@/app/pro/_components/BarChart";
import { MethodBreakdown } from "@/app/pro/_components/MethodBreakdown";
import {
  PRESETS,
  presetRange,
  isValidYMD,
  fromDateToISO,
  toDateToISO,
} from "@/lib/date-ranges";

const METHOD_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  bizum: "Bizum",
  efectivo: "Efectivo",
  bono: "Bono",
  none: "Sin especificar",
};

function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00`).toLocaleDateString("es-ES", {
    month: "short",
    year: "2-digit",
  });
}

function resolveStatus(raw?: string): "paid" | "pending" | undefined {
  return raw === "paid" || raw === "pending" ? raw : undefined;
}
function resolveMethod(raw?: string): string | undefined {
  return (PAYMENT_METHOD_FILTERS as readonly string[]).includes(raw ?? "")
    ? raw
    : undefined;
}

export default async function PaymentsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    method?: string;
    patient?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = resolveStatus(sp.status);
  const method = resolveMethod(sp.method);
  const patientId = sp.patient || undefined;
  const from = isValidYMD(sp.from) ? sp.from : undefined;
  const to = isValidYMD(sp.to) ? sp.to : undefined;
  const PAGE_SIZE = 25;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [history, patients] = await Promise.all([
    getProfessionalPayments({
      status,
      method,
      patientId,
      fromISO: from ? fromDateToISO(from) : undefined,
      toISO: to ? toDateToISO(to) : undefined,
    }),
    getPatientsForSelect(),
  ]);

  const total = history.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = history.rows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const firstRow = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(safePage * PAGE_SIZE, total);

  const baseParams = () => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (method) p.set("method", method);
    if (patientId) p.set("patient", patientId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  };
  const withParams = (mut: (p: URLSearchParams) => void) => {
    const p = baseParams();
    mut(p);
    const qs = p.toString();
    return qs ? `/pro/pagos/historico?${qs}` : "/pro/pagos/historico";
  };
  const pageHref = (n: number) => withParams((p) => n > 1 && p.set("page", String(n)));
  const exportQs = baseParams().toString();
  const exportHref = exportQs ? `/pro/pagos/export?${exportQs}` : "/pro/pagos/export";

  // "Hoy" fuera del render de JSX (regla de pureza): presets con la fecha actual.
  const now = new Date();
  const presets = PRESETS.map((preset) => {
    const r = presetRange(preset.key, now);
    const p = baseParams();
    p.set("from", r.from);
    p.set("to", r.to);
    return {
      ...preset,
      href: `/pro/pagos/historico?${p.toString()}`,
      active: from === r.from && to === r.to,
    };
  });

  const hasFilters = !!status || !!method || !!patientId || !!from || !!to;
  const rangeLabel =
    from && to
      ? `del ${formatDate(from)} al ${formatDate(to)}`
      : from
        ? `desde ${formatDate(from)}`
        : to
          ? `hasta ${formatDate(to)}`
          : "";

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <Link
          href="/pro/pagos"
          className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"
        >
          <ChevronLeft size={15} strokeWidth={1.8} aria-hidden />
          Pagos
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title">Histórico de pagos</h1>
            <p className="mt-1.5 text-[13.5px] text-ink-2">
              {total} {total === 1 ? "pago" : "pagos"}
              {rangeLabel ? `, ${rangeLabel}` : ""}
            </p>
          </div>
          <a href={exportHref} className="btn-ghost">
            Exportar CSV
          </a>
        </div>
      </div>

      {/* Presets rápidos de rango (GET, sin JS). */}
      <div className="segmented flex-wrap" role="group" aria-label="Rango de fechas">
        {presets.map((p) => (
          <Link key={p.key} href={p.href} aria-current={p.active ? "true" : undefined}>
            {p.label}
          </Link>
        ))}
      </div>

      {/* Filtros (GET, sin JS). Bloque tintado sin borde: agrupa los controles
          sin añadir otra caja con línea a una pantalla que ya trae tabla. */}
      <form method="get" className="tinted flex flex-wrap items-end gap-2.5 p-4">
        <label className="block">
          <span className="field-label">Desde</span>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            max={to ?? undefined}
            className="field w-auto"
          />
        </label>
        <label className="block">
          <span className="field-label">Hasta</span>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            min={from ?? undefined}
            className="field w-auto"
          />
        </label>
        <label className="block">
          <span className="field-label">Estado</span>
          <select name="status" defaultValue={status ?? ""} className="field w-auto">
            <option value="">Todos</option>
            <option value="paid">Cobrado</option>
            <option value="pending">Pendiente</option>
          </select>
        </label>
        <label className="block">
          <span className="field-label">Método</span>
          <select name="method" defaultValue={method ?? ""} className="field w-auto">
            <option value="">Todos</option>
            {PAYMENT_METHOD_FILTERS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Paciente</span>
          <select
            name="patient"
            defaultValue={patientId ?? ""}
            className="field w-auto max-w-48"
          >
            <option value="">Todos</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? "Sin nombre"}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Filtrar
        </button>
        {hasFilters && (
          <Link href="/pro/pagos/historico" className="btn-subtle">
            Limpiar
          </Link>
        )}
      </form>

      {/* Resumen del conjunto filtrado: cifras sin caja. */}
      <section className="grid grid-cols-1 gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          rotulo="Cobrado"
          valor={formatCurrency(history.totalPaidCents)}
          pie={`${history.paidCount} ${history.paidCount === 1 ? "pago" : "pagos"}`}
        />
        <Cifra
          rotulo="Pendiente"
          valor={formatCurrency(history.totalPendingCents)}
          pie={`${history.pendingCount} ${history.pendingCount === 1 ? "pago" : "pagos"}`}
        />
        <Cifra rotulo="Pagos en total" valor={String(total)} pie="con estos filtros" />
        <Cifra
          rotulo="Importe medio"
          valor={
            history.paidCount > 0
              ? formatCurrency(Math.round(history.totalPaidCents / history.paidCount))
              : "—"
          }
          pie="por pago cobrado"
        />
      </section>

      {/* Analítica: ingresos por mes + reparto por método. */}
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
                data={[...history.byMonth]
                  .reverse()
                  .map((m) => ({ label: monthLabel(m.month), value: m.paidCents }))}
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

      {/* Listado */}
      {pageRows.length === 0 ? (
        <p className="empty">
          Ningún pago cuadra con estos filtros. Amplía el rango de fechas o
          quítalos con «Limpiar».
        </p>
      ) : (
        <div className="table-wrap overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Paciente</th>
                <th className="text-right">Importe</th>
                <th>Método</th>
                <th>Estado</th>
                <th>Sesión</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.id} className="row-hover">
                  <td className="whitespace-nowrap text-ink-2">
                    {formatDate(p.paid_at ?? p.created_at)}
                  </td>
                  <td>
                    <Link
                      href={`/pro/patients/${p.patient_id}?tab=pagos`}
                      className="font-medium hover:text-accent"
                    >
                      {p.patientName ?? "Sin nombre"}
                    </Link>
                  </td>
                  <td className="mono text-right font-medium whitespace-nowrap">
                    {formatCurrency(p.amount_cents, p.currency)}
                  </td>
                  <td className="text-ink-2">
                    {p.session_pack_id ? "Bono" : paymentMethodLabel(p.method)}
                  </td>
                  <td>
                    {p.status === "paid" ? (
                      <Status tone="success">Cobrado</Status>
                    ) : (
                      <Status tone="warn">Pendiente</Status>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-ink-3">
                    {p.sessionAt ? formatDateTime(p.sessionAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-[12.5px] text-ink-4">
            {firstRow}–{lastRow} de {total}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              {safePage > 1 ? (
                <Link href={pageHref(safePage - 1)} className="btn-ghost btn-sm" rel="prev">
                  <ChevronLeft size={15} strokeWidth={1.8} aria-hidden />
                  Anterior
                </Link>
              ) : (
                <span className="btn-ghost btn-sm cursor-not-allowed opacity-45">
                  <ChevronLeft size={15} strokeWidth={1.8} aria-hidden />
                  Anterior
                </span>
              )}
              <span className="px-1 text-[12.5px] text-ink-2">
                Página {safePage} de {totalPages}
              </span>
              {safePage < totalPages ? (
                <Link href={pageHref(safePage + 1)} className="btn-ghost btn-sm" rel="next">
                  Siguiente
                  <ChevronRight size={15} strokeWidth={1.8} aria-hidden />
                </Link>
              ) : (
                <span className="btn-ghost btn-sm cursor-not-allowed opacity-45">
                  Siguiente
                  <ChevronRight size={15} strokeWidth={1.8} aria-hidden />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-[12.5px] text-ink-4">
        Seguimiento de pagos para la gestoría. terap.ia no emite facturas.
      </p>
    </div>
  );
}

/** Cifra sin caja: rótulo, número y pie. Ver `docs/DESIGN.md`. */
function Cifra({
  rotulo,
  valor,
  pie,
}: {
  rotulo: string;
  valor: string;
  pie: string;
}) {
  return (
    <div>
      <div className="text-[13px] text-ink-3">{rotulo}</div>
      <div className="figure mt-1">{valor}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-2">{pie}</div>
    </div>
  );
}
