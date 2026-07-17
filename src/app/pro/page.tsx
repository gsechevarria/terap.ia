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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {patients.length} {patients.length === 1 ? "paciente" : "pacientes"}
          </p>
        </div>
        <Link
          href="/pro/patients/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Nuevo paciente
        </Link>
      </div>

      {/* Filtro por estado */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <StatusTab label="Activos" value="active" current={status} tag={tag} />
        <StatusTab label="Archivados" value="archived" current={status} tag={tag} />
        <StatusTab label="Todos" value="all" current={status} tag={tag} />
      </div>

      {/* Filtro por etiqueta */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TagChip label="Todas las etiquetas" href={buildHref(status, undefined)} active={!tag} />
          {tags.map((t) => (
            <TagChip key={t} label={t} href={buildHref(status, t)} active={tag === t} />
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="mt-6 flex flex-col gap-3">
        {patients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/[.15] p-8 text-center text-sm text-neutral-500 dark:border-white/[.15]">
            No hay pacientes con este filtro.{" "}
            <Link href="/pro/patients/new" className="underline">
              Crea el primero
            </Link>
            .
          </div>
        ) : (
          patients.map((p) => <PatientRow key={p.id} patient={p} />)
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
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "border border-black/[.12] hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
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
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900"
          : "bg-black/[.05] text-neutral-600 hover:bg-black/[.09] dark:bg-white/[.08] dark:text-neutral-300"
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
      className="flex flex-col gap-3 rounded-xl border border-black/[.08] p-4 transition-colors hover:bg-black/[.02] dark:border-white/[.12] dark:hover:bg-white/[.04] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {patient.full_name ?? "Sin nombre"}
          </span>
          {patient.status === "archived" && (
            <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
              archivado
            </span>
          )}
          {patient.openAlerts > 0 && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
              {patient.openAlerts} alerta{patient.openAlerts > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {patient.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {patient.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-black/[.05] px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-white/[.08] dark:text-neutral-300"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500">
        <Stat label="Tareas pendientes" value={String(patient.pendingTasks)} />
        <Stat label="Próxima cita" value={formatDateTime(patient.nextAppointment)} />
        <Stat label="Última actividad" value={formatDate(patient.lastActivity)} />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <span className="text-neutral-700 dark:text-neutral-200">{value}</span>
    </span>
  );
}
