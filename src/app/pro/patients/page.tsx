import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Plus } from "lucide-react";
import {
  listPatientsWithOverview,
  listPatientTags,
  type PatientOverview,
} from "@/lib/queries/patients";
import type { PatientStatus } from "@/lib/types";
import { Status, StatusCritical } from "@/components/ui/Status";
import { PatientSearch } from "@/app/pro/_components/PatientSearch";
import { formatDate, formatDateTime } from "@/lib/format";

type SP = { status?: string; tag?: string; q?: string };

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
  const q = sp.q?.trim() ?? "";

  const [patients, tags] = await Promise.all([
    listPatientsWithOverview({ status, tag, search: q }),
    listPatientTags(),
  ]);

  const conAlertas = patients.filter((p) => p.openAlerts > 0);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Pacientes</h1>
          <p className="mt-1.5 text-sm text-ink-2">
            {patients.length} {patients.length === 1 ? "expediente" : "expedientes"}
            {status === "active"
              ? " en seguimiento"
              : status === "archived"
                ? " archivados"
                : " en total"}
          </p>
        </div>
        <Link href="/pro/patients/new" className="btn-primary">
          <Plus size={16} strokeWidth={1.75} aria-hidden /> Nuevo paciente
        </Link>
      </header>

      {conAlertas.length > 0 && <BandaAlertas pacientes={conAlertas} />}

      {/* Filtros: búsqueda, estado y etiqueta */}
      <section className="mt-7 space-y-4" aria-label="Filtros">
        <Suspense fallback={<div className="field h-10 max-w-sm" aria-hidden />}>
          <div className="max-w-sm">
            <PatientSearch initialValue={q} />
          </div>
        </Suspense>

        <div className="tabs">
          <FiltroEstado label="Activos" value="active" current={status} tag={tag} q={q} />
          <FiltroEstado label="Archivados" value="archived" current={status} tag={tag} q={q} />
          <FiltroEstado label="Todos" value="all" current={status} tag={tag} q={q} />
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <EtiquetaFiltro
              label="Todas las etiquetas"
              href={construirHref(status, undefined, q)}
              activa={!tag}
            />
            {tags.map((t) => (
              <EtiquetaFiltro
                key={t}
                label={t}
                href={construirHref(status, t, q)}
                activa={tag === t}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6" aria-label="Listado de pacientes">
        {patients.length === 0 ? (
          <p className="empty">
            {q ? (
              <>
                No se encontraron pacientes para{" "}
                <span className="font-medium text-ink">«{q}»</span>
                {status === "active"
                  ? " entre los activos."
                  : status === "archived"
                    ? " entre los archivados."
                    : "."}
              </>
            ) : (
              <>
                No hay pacientes con este filtro.{" "}
                <Link
                  href="/pro/patients/new"
                  className="font-medium text-accent hover:underline"
                >
                  Cree el primero
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {patients.map((p) => (
              <li key={p.id}>
                <FilaPaciente paciente={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Banda de alertas clínicas prioritarias. Precede al listado y es sobria a
 * propósito: informa de que hay respuestas con ítems de riesgo por revisar y
 * lleva directamente a ellas. Ni alarmismo ni interpretación clínica — la
 * lectura del caso es del profesional.
 */
function BandaAlertas({ pacientes }: { pacientes: PatientOverview[] }) {
  const total = pacientes.reduce((suma, p) => suma + p.openAlerts, 0);
  return (
    <section className="alert-clinical mt-6" aria-labelledby="alertas-titulo">
      {/* El punto va suelto, fuera de `.st`, así que lleva su geometría
          explícita: las reglas de `.dot` están acotadas a `.st .dot`. */}
      <span
        aria-hidden
        className="d-danger mt-1.5 block size-2 shrink-0 rounded-full"
        style={{ boxShadow: "0 0 0 3px color-mix(in srgb, currentColor 20%, transparent)" }}
      />
      <div className="min-w-0 flex-1">
        <h2 id="alertas-titulo" className="font-semibold">
          {total === 1
            ? "Hay 1 respuesta con ítem de riesgo pendiente de revisar"
            : `Hay ${total} respuestas con ítem de riesgo pendientes de revisar`}
        </h2>
        <p className="mt-1 text-ink-2">
          Corresponden a {pacientes.length}{" "}
          {pacientes.length === 1 ? "expediente" : "expedientes"}. Revíselas en su
          ficha clínica.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {pacientes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pro/patients/${p.id}?tab=escalas`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
              >
                {p.full_name ?? "Sin nombre"}
                <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function construirHref(
  status: PatientStatus | "all",
  tag?: string,
  q?: string,
): string {
  const params = new URLSearchParams();
  if (status !== "active") params.set("status", status);
  if (tag) params.set("tag", tag);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/pro/patients?${qs}` : "/pro/patients";
}

function FiltroEstado({
  label,
  value,
  current,
  tag,
  q,
}: {
  label: string;
  value: PatientStatus | "all";
  current: PatientStatus | "all";
  tag?: string;
  q?: string;
}) {
  const activa = current === value;
  return (
    <Link
      href={construirHref(value, tag, q)}
      aria-current={activa ? "page" : undefined}
      className={`tab${activa ? " tab-active" : ""}`}
    >
      {label}
    </Link>
  );
}

function EtiquetaFiltro({
  label,
  href,
  activa,
}: {
  label: string;
  href: string;
  activa: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={activa ? "true" : undefined}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150 ${
        activa
          ? "border-accent/30 bg-accent-soft text-accent"
          : "border-line bg-surface-2 text-ink-2 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function FilaPaciente({ paciente }: { paciente: PatientOverview }) {
  const archivado = paciente.status === "archived";
  return (
    <Link
      href={`/pro/patients/${paciente.id}`}
      className="row-hover flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-accent-soft text-[13px] font-semibold text-accent"
        >
          {(paciente.full_name ?? "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="truncate text-body-lg font-semibold text-ink">
              {paciente.full_name ?? "Sin nombre"}
            </span>
            {paciente.openAlerts > 0 ? (
              <StatusCritical>
                {paciente.openAlerts === 1
                  ? "Requiere atención"
                  : `Requiere atención · ${paciente.openAlerts}`}
              </StatusCritical>
            ) : (
              <Status tone={archivado ? "neutral" : "success"}>
                {archivado ? "Archivado" : "En seguimiento"}
              </Status>
            )}
            {/* Sin cuenta, nada de lo que se le asigne le llega. Se dice aquí
                porque dos fichas con el mismo nombre —una vinculada y otra
                no— eran indistinguibles, y elegir la equivocada no avisaba. */}
            {!paciente.tieneCuenta && (
              <Status tone="warn">Sin cuenta</Status>
            )}
          </div>
          {paciente.tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {paciente.tags.map((t) => (
                <li key={t} className="chip">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {/*
        Rejilla de columnas que miden lo mismo en TODAS las filas.

        Cada fila es su propio contenedor, así que el navegador no las cuadra
        entre sí: el bloque se dimensionaba por su contenido y, al ir pegado a
        la derecha, la única fila con cita («16 sept, 08:30») era más ancha que
        las que llevan «—» y arrastraba las tres columnas hacia la izquierda.

        La solución no lleva ni un ancho a ojo: el valor reserva su sitio en
        `ch`, que es el ancho del carácter de SU PROPIA fuente —y como es
        monoespaciada, `14ch` es exactamente «16 sept, 08:30»—. La columna se
        queda entonces en el mayor de la etiqueta y esa reserva, y ambas son
        idénticas fila a fila, así que la vertical cuadra por construcción y no
        por acierto. `DD mmm, HH:MM` y `DD mmm YYYY` con «sept», el mes
        abreviado más largo en español, son el caso peor.

        En móvil la fila se apila, el bloque cae debajo del nombre y no hay nada
        que cuadrar: ahí sigue fluyendo, que es lo que evita el desbordamiento
        lateral en pantallas estrechas.
      */}
      <dl className="flex flex-wrap gap-x-6 gap-y-2 pl-[3.375rem] text-xs sm:grid sm:shrink-0 sm:grid-cols-[auto_auto_auto] sm:pl-0">
        <Dato label="Tareas pendientes" valor={String(paciente.pendingTasks)} ancho="w-[3ch]" />
        <Dato label="Próxima cita" valor={formatDateTime(paciente.nextAppointment)} ancho="w-[14ch]" />
        <Dato label="Última actividad" valor={formatDate(paciente.lastActivity)} ancho="w-[12ch]" />
      </dl>
    </Link>
  );
}

function Dato({
  label,
  valor,
  ancho,
}: {
  label: string;
  valor: string;
  /** Sitio que reserva el valor, en `ch` de su propia fuente monoespaciada. */
  ancho: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[10px] font-medium tracking-wide text-ink-3 uppercase">
        {label}
      </dt>
      {/* `truncate` es el seguro: si un valor creciera más de lo previsto se
          recorta en su columna en vez de ensanchar la rejilla y descuadrar la
          fila entera otra vez. */}
      <dd className={`mono truncate text-ink-2 ${ancho}`}>{valor}</dd>
    </div>
  );
}
