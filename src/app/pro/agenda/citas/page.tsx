import Link from "next/link";
import {
  getPatientsForSelect,
  listProfessionalAppointments,
  type AppointmentScope,
} from "@/lib/queries/appointments";
import type { Appointment } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "programada",
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
  searchParams: Promise<{ scope?: string; status?: string; patient?: string }>;
}) {
  const sp = await searchParams;
  const scope = resolveScope(sp.scope);
  const status = resolveStatus(sp.status);
  const patientId = sp.patient || undefined;

  const [appointments, patients] = await Promise.all([
    listProfessionalAppointments({ scope, status, patientId }),
    getPatientsForSelect(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/pro/agenda" className="text-sm text-ink-3 hover:text-ink">
        ← Agenda
      </Link>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Todas las citas</h1>
          <p className="mt-1 text-sm text-ink-2">
            {appointments.length} {appointments.length === 1 ? "cita" : "citas"}
            {scope === "upcoming"
              ? " próximas"
              : scope === "past"
                ? " pasadas"
                : ""}
          </p>
        </div>
      </div>

      {/* Filtros (GET, sin JS) */}
      <form
        method="get"
        className="mt-5 flex flex-wrap items-end gap-2 rounded-lg bg-panel p-3"
      >
        <label className="block">
          <span className="field-label">Cuándo</span>
          <select name="scope" defaultValue={scope} className="field w-auto">
            <option value="all">Todas</option>
            <option value="upcoming">Próximas</option>
            <option value="past">Pasadas</option>
          </select>
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
        {(scope !== "all" || status || patientId) && (
          <Link href="/pro/agenda/citas" className="btn-subtle">
            Limpiar
          </Link>
        )}
      </form>

      {/* Listado */}
      {appointments.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-2">
          No hay citas con estos filtros.
        </p>
      ) : (
        <div className="card mt-5 overflow-x-auto">
          <table className="table-base">
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
                    className={`row-hover last:[&>td]:border-b-0 ${
                      a.status === "cancelled" ? "opacity-60" : ""
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
                      <span
                        className={
                          a.status === "confirmed"
                            ? "rounded-sm bg-accent-soft px-1.5 py-px text-xs font-medium text-accent"
                            : a.status === "scheduled"
                              ? "rounded-sm bg-info-soft px-1.5 py-px text-xs font-medium text-info"
                              : "chip"
                        }
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
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
                          className="mr-3 text-xs font-medium text-accent hover:underline"
                        >
                          Video
                        </a>
                      )}
                      <a
                        href={`/appointments/${a.id}/ics`}
                        className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink"
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
      )}
    </div>
  );
}
