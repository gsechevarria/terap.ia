import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getPatientsForSelect,
  listProfessionalAppointments,
  type AppointmentScope,
} from "@/lib/queries/appointments";
import type { Appointment } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { Status, type StatusTone } from "@/components/ui/Status";
import { Migas } from "@/app/pro/_components/Migas";
import {
  PRESETS,
  presetRange,
  isValidYMD,
  fromDateToISO,
  toDateToISO,
} from "@/lib/date-ranges";

/* «sin confirmar» y no «programada»: es la misma palabra que usan el calendario
   y la pantalla de hoy para `scheduled`, y tenerla escrita de tres maneras
   distintas obligaba a traducir mentalmente entre pantallas. */
const STATUS_LABEL: Record<string, string> = {
  scheduled: "sin confirmar",
  confirmed: "confirmada",
  cancelled: "cancelada",
  completed: "completada",
};
const ATTENDANCE_LABEL: Record<string, string> = {
  pending: "—",
  attended: "acudió",
  no_show: "no acudió",
  late_cancel: "canceló tarde",
};
const STATUSES = ["scheduled", "confirmed", "completed", "cancelled"] as const;
const STATUS_TONE: Record<string, StatusTone> = {
  scheduled: "warn",
  confirmed: "accent",
  completed: "neutral",
  cancelled: "neutral",
};

/** Día local (no UTC) para enlazar con la vista de día del calendario. */
function localYMD(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function resolveScope(raw?: string): AppointmentScope {
  return raw === "upcoming" || raw === "past" ? raw : "all";
}
function resolveStatus(raw?: string): Appointment["status"] | undefined {
  return (STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as Appointment["status"])
    : undefined;
}

export default async function AllAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    status?: string;
    patient?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const scope = resolveScope(sp.scope);
  const status = resolveStatus(sp.status);
  const patientId = sp.patient || undefined;
  const from = isValidYMD(sp.from) ? sp.from : undefined;
  const to = isValidYMD(sp.to) ? sp.to : undefined;
  const PAGE_SIZE = 25;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows: appointments, total }, patients] = await Promise.all([
    listProfessionalAppointments({
      scope,
      status,
      patientId,
      fromISO: from ? fromDateToISO(from) : undefined,
      toISO: to ? toDateToISO(to) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    getPatientsForSelect(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (scope !== "all") p.set("scope", scope);
    if (status) p.set("status", status);
    if (patientId) p.set("patient", patientId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    return qs ? `/pro/agenda/citas?${qs}` : "/pro/agenda/citas";
  };

  // "Hoy" fuera del render de JSX: presets calculados en el cuerpo del server component.
  const now = new Date();
  const presetHref = (fromYMD: string, toYMD: string) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (patientId) p.set("patient", patientId);
    p.set("from", fromYMD);
    p.set("to", toYMD);
    return `/pro/agenda/citas?${p.toString()}`;
  };
  const presets = PRESETS.map((preset) => {
    const r = presetRange(preset.key, now);
    return {
      ...preset,
      href: presetHref(r.from, r.to),
      active: from === r.from && to === r.to,
    };
  });

  const hasFilters = scope !== "all" || !!status || !!patientId || !!from || !!to;
  const rangeLabel =
    from && to
      ? `del ${formatDate(from)} al ${formatDate(to)}`
      : from
        ? `desde ${formatDate(from)}`
        : to
          ? `hasta ${formatDate(to)}`
          : "";

  return (
    // A lo ancho, como el resto del panel: la tabla tiene cinco columnas y
    // agradece el sitio. Migas en vez del «← Agenda».
    <div>
      <Migas tramos={[{ href: "/pro/agenda", texto: "Agenda" }, { texto: "Todas las citas" }]} />
      <h1 className="page-title mt-3">Todas las citas</h1>
      <p className="mt-3 max-w-[600px] text-body-lg text-ink-2">
        {total} {total === 1 ? "cita" : "citas"}
        {scope === "upcoming" ? " próximas" : scope === "past" ? " pasadas" : ""}
        {rangeLabel ? `, ${rangeLabel}` : ""}.
      </p>

      {/* Filtros (GET, sin JS). La zona se separa con una línea y aire, no con
          una caja de fondo gris: competía con la tabla que hay justo debajo. */}
      <div className="mt-6 border-t border-line pt-5">
        <div className="segmented flex-wrap" role="group" aria-label="Rango rápido">
          {presets.map((p) => (
            <Link
              key={p.key}
              href={p.href}
              aria-current={p.active ? "page" : undefined}
            >
              {p.label}
            </Link>
          ))}
        </div>

        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="field-label">Cuándo</span>
            <select name="scope" defaultValue={scope} className="field w-auto">
              <option value="all">Todas</option>
              <option value="upcoming">Próximas</option>
              <option value="past">Pasadas</option>
            </select>
          </label>
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
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
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
            <Link href="/pro/agenda/citas" className="btn-subtle">
              Limpiar
            </Link>
          )}
        </form>
      </div>

      {/* Listado */}
      {appointments.length === 0 ? (
        <p className="empty mt-6">
          No hay citas con estos filtros. Amplía el rango de fechas o quita el
          estado para ver más.
        </p>
      ) : (
        <div className="mt-6">
          <div className="overflow-x-auto">
            <table className="table-base table-plain">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Estado</th>
                  <th>Asistencia</th>
                  <th className="text-right">Enlaces</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => {
                  const dayYMD = localYMD(a.starts_at);
                  return (
                    <tr
                      key={a.id}
                      className={`row-hover ${
                        a.status === "cancelled" ? "[&>td]:text-ink-disabled" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap">
                        <Link
                          href={`/pro/agenda?view=day&date=${dayYMD}`}
                          className="hover:underline"
                          title="Abrir en el calendario"
                        >
                          {formatDateTime(a.starts_at)}
                        </Link>
                      </td>
                      <td>
                        <Link
                          href={`/pro/patients/${a.patient_id}`}
                          className="font-medium hover:underline"
                        >
                          {a.patientName ?? "Sin nombre"}
                        </Link>
                      </td>
                      <td>
                        <Status tone={STATUS_TONE[a.status] ?? "neutral"}>
                          {STATUS_LABEL[a.status] ?? a.status}
                        </Status>
                      </td>
                      <td className="text-ink-2">
                        {ATTENDANCE_LABEL[a.attendance] ?? a.attendance}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {a.video_link && (
                          <a
                            href={a.video_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mr-3 text-[12.5px] font-medium text-accent hover:underline"
                          >
                            Videollamada
                          </a>
                        )}
                        <a
                          href={`/appointments/${a.id}/ics`}
                          className="text-[12.5px] text-ink-3 underline underline-offset-2 hover:text-ink"
                        >
                          .ics
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginación */}
      {total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-[12.5px] text-ink-4">
            {firstRow}–{lastRow} de {total}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="btn-ghost btn-sm" rel="prev">
                  <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
                  Anterior
                </Link>
              ) : (
                <span className="btn-ghost btn-sm cursor-not-allowed opacity-45">
                  <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
                  Anterior
                </span>
              )}
              <span className="px-1 text-[12.5px] text-ink-2">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="btn-ghost btn-sm" rel="next">
                  Siguiente
                  <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                </Link>
              ) : (
                <span className="btn-ghost btn-sm cursor-not-allowed opacity-45">
                  Siguiente
                  <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
