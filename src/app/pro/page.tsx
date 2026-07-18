import Link from "next/link";
import {
  listPatientsWithOverview,
  listPatientTags,
  type PatientOverview,
} from "@/lib/queries/patients";
import type { PatientStatus } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";

type SP = { status?: string; tag?: string };

function resolveStatus(raw?: string): PatientStatus | "all" {
  if (raw === "archived" || raw === "all") return raw;
  return "active";
}

export default async function ProDashboard({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const status = resolveStatus(sp.status);
  const tag = sp.tag;

  const [patients, tags] = await Promise.all([
    listPatientsWithOverview({ status, tag }),
    listPatientTags(),
  ]);

  const withAlerts = patients.filter((p) => p.openAlerts > 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Pacientes</h1>
          <p className="mt-1 text-sm text-ink-2">
            {patients.length} {patients.length === 1 ? "paciente" : "pacientes"}
          </p>
        </div>
        <Link href="/pro/patients/new" className="btn-primary">
          Nuevo paciente
        </Link>
      </div>

      {withAlerts.length > 0 && (
        <div className="mt-5 flex items-start gap-2.5 rounded border border-danger/25 bg-danger-soft p-3 text-sm text-danger">
          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-danger" />
          <p>
            <span className="font-semibold">Alertas por revisar:</span>{" "}
            {withAlerts.map((p, i) => (
              <span key={p.id}>
                <Link
                  href={`/pro/patients/${p.id}?tab=escalas`}
                  className="font-medium underline underline-offset-2"
                >
                  {p.full_name ?? "Sin nombre"}
                </Link>
                {i < withAlerts.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* Filtro por estado */}
      <div className="mt-6 flex flex-wrap items-center gap-1">
        <StatusTab label="Activos" value="active" current={status} tag={tag} />
        <StatusTab label="Archivados" value="archived" current={status} tag={tag} />
        <StatusTab label="Todos" value="all" current={status} tag={tag} />
      </div>

      {/* Filtro por etiqueta */}
      {tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <TagChip
            label="Todas las etiquetas"
            href={buildHref(status, undefined)}
            active={!tag}
          />
          {tags.map((t) => (
            <TagChip key={t} label={t} href={buildHref(status, t)} active={tag === t} />
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="mt-5">
        {patients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-10 text-center text-sm text-ink-2">
            No hay pacientes con este filtro.{" "}
            <Link
              href="/pro/patients/new"
              className="font-medium text-accent hover:underline"
            >
              Crea el primero
            </Link>
            .
          </div>
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {patients.map((p) => (
              <PatientRow key={p.id} patient={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function buildHref(status: PatientStatus | "all", tag?: string): string {
  const params = new URLSearchParams();
  if (status !== "active") params.set("status", status);
  if (tag) params.set("tag", tag);
  const qs = params.toString();
  return qs ? `/pro?${qs}` : "/pro";
}

function StatusTab({
  label,
  value,
  current,
  tag,
}: {
  label: string;
  value: PatientStatus | "all";
  current: PatientStatus | "all";
  tag?: string;
}) {
  const active = current === value;
  return (
    <Link
      href={buildHref(value, tag)}
      className={`rounded px-2.5 py-1 text-sm transition-colors duration-100 ${
        active
          ? "bg-wash-2 font-medium text-ink"
          : "text-ink-2 hover:bg-wash hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function TagChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-sm px-1.5 py-0.5 text-xs font-medium transition-colors duration-100 ${
        active
          ? "bg-accent-soft text-accent"
          : "bg-panel text-ink-2 hover:bg-wash-2"
      }`}
    >
      {label}
    </Link>
  );
}

function PatientRow({ patient }: { patient: PatientOverview }) {
  return (
    <Link
      href={`/pro/patients/${patient.id}`}
      className="row-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-semibold text-ink-2">
          {(patient.full_name ?? "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {patient.full_name ?? "Sin nombre"}
            </span>
            {patient.status === "archived" && (
              <span className="chip">archivado</span>
            )}
            {patient.openAlerts > 0 && (
              <span className="rounded-sm bg-danger-soft px-1.5 py-px text-xs font-semibold text-danger">
                {patient.openAlerts} alerta{patient.openAlerts > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {patient.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {patient.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 pl-11 text-xs sm:pl-0">
        <Stat label="Tareas pendientes" value={String(patient.pendingTasks)} />
        <Stat label="Próxima cita" value={formatDateTime(patient.nextAppointment)} />
        <Stat label="Última actividad" value={formatDate(patient.lastActivity)} />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
        {label}
      </span>
      <span className="text-ink-2">{value}</span>
    </span>
  );
}
