import type { CalendarView } from "@/app/pro/_components/AgendaCalendar";

/**
 * Resuelve la ventana temporal del calendario de agenda a partir de los query
 * params (?view=&date=): rango a consultar [from, to), etiqueta legible y
 * fechas de navegación. Vive en la capa lib (no en el render) porque usa la
 * fecha actual como valor por defecto.
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

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function resolveAgendaWindow(
  viewRaw?: string,
  dateRaw?: string,
): AgendaWindow {
  const view: CalendarView =
    viewRaw === "day" || viewRaw === "month" ? viewRaw : "week";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? parseYMD(dateRaw) : today;

  let from: Date;
  let to: Date;
  let label: string;
  let prev: Date;
  let next: Date;

  if (view === "day") {
    from = date;
    to = addDays(date, 1);
    prev = addDays(date, -1);
    next = addDays(date, 1);
    label = date.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } else if (view === "week") {
    const mon = mondayOf(date);
    const sun = addDays(mon, 6);
    from = mon;
    to = addDays(mon, 7);
    prev = addDays(date, -7);
    next = addDays(date, 7);
    label =
      mon.getMonth() === sun.getMonth()
        ? `${mon.getDate()} – ${sun.getDate()} de ${sun.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`
        : `${mon.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`;
  } else {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const gridStart = mondayOf(first);
    from = gridStart;
    to = addDays(gridStart, 42);
    prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    label = first.toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
  }

  return {
    view,
    dateYMD: ymd(date),
    todayYMD: ymd(today),
    fromISO: from.toISOString(),
    toISO: to.toISOString(),
    label,
    prevYMD: ymd(prev),
    nextYMD: ymd(next),
  };
}
