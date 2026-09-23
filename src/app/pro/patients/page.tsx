import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Pacientes</h1>
          <p className="mt-2.5 text-[13.5px] text-ink-2">
            {patients.length} {patients.length === 1 ? "expediente" : "expedientes"}
            {status === "active"
              ? " en seguimiento"
              : status === "archived"
                ? " archivados"
                : " en total"}
          </p>
        </div>
        <Link href="/pro/patients/new" className="btn-primary mt-1.5">
          <Plus size={16} strokeWidth={1.75} aria-hidden /> Nuevo paciente
        </Link>
      </header>

      {conAlertas.length > 0 && <BandaAlertas pacientes={conAlertas} />}

      {/* Filtros: búsqueda, estado y etiqueta */}
      <section className="mt-8 space-y-4" aria-label="Filtros">
        <Suspense fallback={<div className="field h-[42px] max-w-sm" aria-hidden />}>
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
                Ningún paciente coincide con{" "}
                <span className="font-medium text-ink">«{q}»</span>
                {status === "active"
                  ? " entre los activos"
                  : status === "archived"
                    ? " entre los archivados"
                    : ""}
                . Se busca por nombre, correo, teléfono y profesión.
              </>
            ) : (
              <>
                No hay pacientes con este filtro.{" "}
                <Link
                  href="/pro/patients/new"
                  className="font-medium text-accent hover:underline"
                >
                  Crea el primero
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          /*
            Tabla de verdad, y no una lista de tarjetas, por una razón concreta.

            Las tres columnas de la derecha tienen que medir lo mismo en todas
            las filas. Cuando cada fila era su propio contenedor, el navegador
            no las cuadraba entre sí: la única fila con cita —«16 sept, 08:30»—
            era más ancha que las que llevan «—» y arrastraba las columnas hacia
            la izquierda. Se parcheaba reservando el hueco en `ch`, con el
            argumento de que la fuente era monoespaciada y `14ch` medía
            exactamente esa fecha. Eso ya no es cierto: el sistema visual tiene
            una familia única y proporcional, así que `ch` es el ancho del cero
            y no dice nada del ancho de «16 sept, 08:30». Un `table` reparte el
            ancho de cada columna mirando TODAS las filas, de modo que la
            vertical cuadra por construcción y las reservas sobran.

            En pantalla estrecha la tabla desplaza en horizontal:
            `overflow-x-auto` gana al `overflow-hidden` de `.table-wrap` porque
            las utilidades van en una capa posterior. Esconder columnas
            escondería datos.
          */
          <div className="table-wrap overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  {/* `w-full` deja que la columna del nombre absorba el ancho
                      sobrante y las de datos se queden en su contenido. */}
                  <th scope="col" className="w-full">
                    Paciente
                  </th>
                  <th scope="col">Tareas pendientes</th>
                  <th scope="col">Próxima cita</th>
                  <th scope="col">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <FilaPaciente key={p.id} paciente={p} />
                ))}
              </tbody>
            </table>
          </div>
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
      <span aria-hidden className="d-danger mt-1.5 block size-2 shrink-0 rounded-full" />
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
                className="inline-flex items-center rounded-lg border border-line bg-surface px-3 py-1 text-[12.5px] font-medium text-ink transition-colors hover:bg-surface-subtle"
              >
                {p.full_name ?? "Sin nombre"}
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
      className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-colors duration-150 ${
        activa
          ? "border-accent/30 bg-accent-soft text-accent"
          : "border-line bg-surface-subtle text-ink-2 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function FilaPaciente({ paciente }: { paciente: PatientOverview }) {
  const archivado = paciente.status === "archived";
  return (
    <tr className="row-hover">
      <td>
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-[13px] font-semibold text-accent"
          >
            {(paciente.full_name ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                href={`/pro/patients/${paciente.id}`}
                className="font-semibold text-ink hover:text-accent"
              >
                {paciente.full_name ?? "Sin nombre"}
              </Link>
              {paciente.openAlerts > 0 ? (
                <StatusCritical>
                  {paciente.openAlerts === 1
                    ? "Requiere atención"
                    : `Requiere atención (${paciente.openAlerts})`}
                </StatusCritical>
              ) : (
                <Status tone={archivado ? "neutral" : "success"}>
                  {archivado ? "Archivado" : "En seguimiento"}
                </Status>
              )}
              {/* Sin cuenta, nada de lo que se le asigne le llega. Se dice aquí
                  porque dos fichas con el mismo nombre —una vinculada y otra
                  no— eran indistinguibles, y elegir la equivocada no avisaba.
                  Va en texto de color y no en pastilla: las rellenas quedan
                  para los contadores y para lo crítico. */}
              {!paciente.tieneCuenta && (
                <span className="text-[12.5px] font-medium text-warning-ink">
                  Sin cuenta
                </span>
              )}
            </div>
            {paciente.tags.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {paciente.tags.map((t) => (
                  <li key={t} className="chip">
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </td>
      <td className="mono text-ink-2">{paciente.pendingTasks}</td>
      <td className="mono whitespace-nowrap text-ink-2">
        {formatDateTime(paciente.nextAppointment)}
      </td>
      <td className="mono whitespace-nowrap text-ink-2">
        {formatDate(paciente.lastActivity)}
      </td>
    </tr>
  );
}
