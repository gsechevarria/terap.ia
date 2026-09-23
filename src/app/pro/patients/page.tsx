import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import {
  listPatientsWithOverview,
  listPatientTags,
  type PatientOverview,
} from "@/lib/queries/patients";
import type { PatientStatus } from "@/lib/types";
import { StatusCritical } from "@/components/ui/Status";
import { PatientSearch } from "@/app/pro/_components/PatientSearch";
import { formatDate, formatTime, nombreDelDia } from "@/lib/format";
import { parseYMD, todayYMD, ymdInTZ } from "@/lib/tz";

type SP = { status?: string; tag?: string; q?: string };

function resolveStatus(raw?: string): PatientStatus | "all" {
  if (raw === "archived" || raw === "all") return raw;
  return "active";
}

/** Días de calendario (en Madrid) de `desdeYMD` a `hastaYMD`. */
function diasEntre(desdeYMD: string, hastaYMD: string): number {
  return Math.round(
    (parseYMD(hastaYMD).getTime() - parseYMD(desdeYMD).getTime()) / 86_400_000,
  );
}

/**
 * Listado de pacientes, con el lenguaje de «Hoy».
 *
 * Misma anchura que «Hoy», sin la columna central de 5xl que dejaba la lista
 * encajonada con media hoja vacía a cada lado; la frase bajo el título hace lo
 * que la de «Hoy»: decir en una línea cómo está la consulta. La tabla va sin
 * caja, directamente sobre la hoja, como «Sin próxima cita», y las fechas se
 * dicen igual que allí —«mañana, 15:00», «hace 19 días»— para que el mismo dato
 * no se lea de dos formas según la pantalla.
 */
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

  // Un solo «hoy» para todas las filas, calculado en el servidor.
  const hoy = todayYMD();
  const conAlertas = patients.filter((p) => p.openAlerts > 0);
  const conCita = patients.filter((p) => p.nextAppointment).length;
  const sinCuenta = patients.filter((p) => !p.tieneCuenta).length;

  return (
    <div className="flex flex-col gap-[22px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">Pacientes</h1>
          <p className="mt-3 max-w-[560px] text-body-lg text-ink-2">
            {frase(patients.length, conCita, sinCuenta, status, q !== "" || tag != null)}
          </p>
        </div>
        <Link href="/pro/patients/new" className="btn-primary mt-1.5">
          <Plus size={16} strokeWidth={1.75} aria-hidden /> Nuevo paciente
        </Link>
      </header>

      {conAlertas.length > 0 && <BandaAlertas pacientes={conAlertas} />}

      <section aria-labelledby="listado-titulo">
        {/* Cabecera de sección como las de «Hoy»: título con su recuento a la
            izquierda y los controles a la derecha, sin caja alrededor. */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h2 id="listado-titulo" className="section-title">
            {status === "active" ? "Activos" : status === "archived" ? "Archivados" : "Todos"}{" "}
            <span className="font-normal text-ink-4">
              {patients.length} {patients.length === 1 ? "paciente" : "pacientes"}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Suspense fallback={<div className="field h-[42px] w-[300px]" aria-hidden />}>
              <div className="w-full sm:w-[300px]">
                <PatientSearch initialValue={q} />
              </div>
            </Suspense>
            <div className="segmented" role="group" aria-label="Estado del expediente">
              <FiltroEstado label="Activos" value="active" current={status} tag={tag} q={q} />
              <FiltroEstado label="Archivados" value="archived" current={status} tag={tag} q={q} />
              <FiltroEstado label="Todos" value="all" current={status} tag={tag} q={q} />
            </div>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filtrar por etiqueta">
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
            Tabla de verdad, para que las columnas cuadren en todas las filas
            (el navegador reparte el ancho mirándolas todas). Sin contenedor ni
            cabecera tintada: las líneas son las de «Sin próxima cita», `--line`
            bajo la cabecera y `--line-soft` entre filas. En pantalla estrecha
            desplaza en horizontal; esconder columnas escondería datos.
          */
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr>
                  <Th className="w-full">Paciente</Th>
                  <Th>Aplicación</Th>
                  <Th>Próxima cita</Th>
                  <Th>Última actividad</Th>
                  <Th className="text-right">Tareas pendientes</Th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <FilaPaciente key={p.id} paciente={p} hoy={hoy} />
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
 * La frase bajo el título. Cuenta lo que hay en pantalla: con una búsqueda o
 * una etiqueta puestas, lo dice, para que «3 pacientes» no se lea como el total
 * de la consulta.
 */
function frase(
  total: number,
  conCita: number,
  sinCuenta: number,
  status: PatientStatus | "all",
  filtrado: boolean,
): string {
  if (total === 0) {
    return filtrado
      ? "Ningún expediente coincide con el filtro."
      : status === "archived"
        ? "No hay expedientes archivados."
        : "Todavía no hay expedientes. Crea el primero y envíale la invitación desde su ficha.";
  }
  const exp = total === 1 ? "expediente" : "expedientes";
  const cabeza =
    status === "active"
      ? `${total} ${exp} en seguimiento`
      : status === "archived"
        ? `${total} ${exp} archivados`
        : `${total} ${exp} en total`;
  const partes = [`${cabeza}${filtrado ? " con este filtro" : ""}.`];
  if (status !== "archived") {
    const sin = total - conCita;
    partes.push(
      sin === 0
        ? "Todos tienen su próxima cita agendada."
        : conCita === 0
          ? "Ninguno tiene cita agendada."
          : `${conCita} ${conCita === 1 ? "tiene" : "tienen"} cita agendada y ${sin} ${sin === 1 ? "no tiene" : "no tienen"} ninguna.`,
    );
  }
  if (sinCuenta > 0) {
    partes.push(
      sinCuenta === total
        ? total === 1
          ? "Aún no tiene cuenta en la aplicación."
          : "Ninguno tiene cuenta en la aplicación todavía."
        : `${sinCuenta} ${sinCuenta === 1 ? "no tiene" : "no tienen"} cuenta en la aplicación.`,
    );
  }
  return partes.join(" ");
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`border-b border-line py-2 pr-6 text-left text-[12.5px] font-normal whitespace-nowrap text-ink-3 last:pr-0 ${className}`}
    >
      {children}
    </th>
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
    <section className="alert-clinical" aria-labelledby="alertas-titulo">
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
  return (
    <Link
      href={construirHref(value, tag, q)}
      aria-current={current === value ? "page" : undefined}
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

/** «hoy, 18:32», «mañana, 15:00», «el viernes, 14:26», «el 14 de octubre, 10:00». */
function proximaCita(iso: string, hoy: string): string {
  const dias = diasEntre(hoy, ymdInTZ(new Date(iso)));
  const dia = nombreDelDia(iso, dias) || "hoy";
  return `${dia}, ${formatTime(iso)}`;
}

/** «hoy», «ayer», «hace 19 días»; pasado mes y medio, la fecha. */
function ultimaActividad(iso: string, hoy: string): string {
  const dias = diasEntre(ymdInTZ(new Date(iso)), hoy);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias <= 45) return `hace ${dias} días`;
  return formatDate(iso);
}

function FilaPaciente({ paciente, hoy }: { paciente: PatientOverview; hoy: string }) {
  const archivado = paciente.status === "archived";
  const celda = "py-3 pr-6 align-middle last:pr-0";
  const linea = { borderBottom: "1px solid var(--line-soft)" };
  return (
    <tr className="row-hover">
      <td className={celda} style={linea}>
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-[13px] font-semibold text-accent"
          >
            {(paciente.full_name ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Link
                href={`/pro/patients/${paciente.id}`}
                className={`font-semibold hover:text-accent ${archivado ? "text-ink-disabled" : "text-ink"}`}
              >
                {paciente.full_name ?? "Sin nombre"}
              </Link>
              {/* Lo crítico es lo único que va en pastilla rellena. */}
              {paciente.openAlerts > 0 && (
                <StatusCritical>
                  {paciente.openAlerts === 1
                    ? "Requiere atención"
                    : `Requiere atención (${paciente.openAlerts})`}
                </StatusCritical>
              )}
              {archivado && <span className="text-[12.5px] text-ink-3">archivado</span>}
            </div>
            {paciente.tags.length > 0 && (
              <p className="mt-0.5 truncate text-[12.5px] text-ink-3">
                {paciente.tags.join(", ")}
              </p>
            )}
          </div>
        </div>
      </td>
      {/* Sin cuenta, nada de lo que se le asigne le llega. Va en texto de
          color, no en pastilla, como el «sin confirmar» de la agenda. */}
      <td className={`${celda} whitespace-nowrap`} style={linea}>
        {paciente.tieneCuenta ? (
          <span className="text-ink-3">Vinculada</span>
        ) : (
          <span className="font-medium text-warning-ink">Sin cuenta</span>
        )}
      </td>
      <td className={`${celda} whitespace-nowrap`} style={linea}>
        {paciente.nextAppointment ? (
          <span className="text-ink-2">{proximaCita(paciente.nextAppointment, hoy)}</span>
        ) : archivado ? (
          <span className="text-ink-3">—</span>
        ) : (
          <Link
            href={`/pro/agenda?patient=${paciente.id}`}
            className="font-semibold text-accent hover:underline"
          >
            Proponer cita
          </Link>
        )}
      </td>
      <td className={`${celda} whitespace-nowrap text-ink-2`} style={linea}>
        {paciente.lastActivity ? (
          ultimaActividad(paciente.lastActivity, hoy)
        ) : (
          <span className="text-ink-3">Sin actividad</span>
        )}
      </td>
      <td className={`${celda} text-right`} style={linea}>
        {paciente.pendingTasks > 0 ? (
          <span className="font-semibold text-ink">{paciente.pendingTasks}</span>
        ) : (
          <span className="text-ink-3">Ninguna</span>
        )}
      </td>
    </tr>
  );
}
