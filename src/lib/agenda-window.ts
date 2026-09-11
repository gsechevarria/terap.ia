import type { CalendarView } from "@/app/pro/_components/AgendaCalendar";
import {
  addDaysYMD,
  formatYMD,
  fromWallClock,
  mondayOfYMD,
  parseYMD,
  todayYMD,
} from "@/lib/tz";

/**
 * Resuelve la ventana temporal del calendario de agenda a partir de los query
 * params (?view=&date=): rango a consultar [from, to), etiqueta legible y
 * fechas de navegación. Vive en la capa lib (no en el render) porque usa la
 * fecha actual como valor por defecto.
 *
 * Dos representaciones, deliberadamente separadas:
 *  - los días del calendario son fechas sin zona, ancladas a UTC (`parseYMD`),
 *    para que sumar días no se vea afectado por el cambio de horario;
 *  - los límites `fromISO`/`toISO` son instantes reales, resueltos con
 *    `fromWallClock` a la medianoche **de Madrid**. Usar el `toISOString()` de
 *    la fecha de calendario dejaría la ventana desplazada 1-2 h y se colarían
 *    (o se perderían) las citas de la primera franja del día.
 */
export type AgendaWindow = {
  view: CalendarView;
  dateYMD: string;
  todayYMD: string;
  fromISO: string;
  toISO: string;
  label: string;
  prevYMD: string;
  nextYMD: string;
};

/** Formatea una fecha de calendario (anclada a UTC) sin que la zona la mueva. */
function label(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString("es-ES", { timeZone: "UTC", ...opts });
}

/** Fecha de calendario → instante de su medianoche en la zona del profesional. */
function startOfDayISO(d: Date): string {
  return fromWallClock(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    0,
    0,
  ).toISOString();
}

export function resolveAgendaWindow(
  viewRaw?: string,
  dateRaw?: string,
): AgendaWindow {
  const view: CalendarView =
    viewRaw === "day" || viewRaw === "month" ? viewRaw : "week";

  const today = todayYMD();
  const date =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      ? parseYMD(dateRaw)
      : parseYMD(today);

  let from: Date;
  let to: Date;
  let text: string;
  let prev: Date;
  let next: Date;

  if (view === "day") {
    from = date;
    to = addDaysYMD(date, 1);
    prev = addDaysYMD(date, -1);
    next = addDaysYMD(date, 1);
    text = label(date, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } else if (view === "week") {
    const mon = mondayOfYMD(date);
    const sun = addDaysYMD(mon, 6);
    from = mon;
    to = addDaysYMD(mon, 7);
    prev = addDaysYMD(date, -7);
    next = addDaysYMD(date, 7);
    text =
      mon.getUTCMonth() === sun.getUTCMonth()
        ? `${mon.getUTCDate()} – ${sun.getUTCDate()} de ${label(sun, { month: "long", year: "numeric" })}`
        : `${label(mon, { day: "numeric", month: "short" })} – ${label(sun, { day: "numeric", month: "short", year: "numeric" })}`;
  } else {
    const first = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    );
    const gridStart = mondayOfYMD(first);
    from = gridStart;
    to = addDaysYMD(gridStart, 42);
    prev = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
    next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    text = label(first, { month: "long", year: "numeric" });
  }

  return {
    view,
    dateYMD: formatYMD(date),
    todayYMD: today,
    fromISO: startOfDayISO(from),
    toISO: startOfDayISO(to),
    label: text,
    prevYMD: formatYMD(prev),
    nextYMD: formatYMD(next),
  };
}
