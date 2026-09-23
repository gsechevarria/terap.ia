"use client";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { callAction } from "@/lib/action-result";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import {
  cancelAppointmentAction,
  deleteAppointmentAction,
  deleteBlockAction,
  setAttendanceAction,
  updateAppointmentAction,
} from "@/lib/actions/appointments";
import {
  formatDateTime,
  formatTime,
  fromDatetimeLocal,
  toDatetimeLocal,
} from "@/lib/format";
import { actionErrorMessage } from "@/lib/errors";
import { safeExternalUrl } from "@/lib/url";
import { layoutDay, type LayoutBox } from "@/lib/appointment-layout";
import {
  TZ,
  addDaysYMD,
  formatYMD,
  fromWallClock,
  minutesOfDayInTZ,
  mondayOfYMD,
  parseYMD,
  todayYMD,
  ymdInTZ,
} from "@/lib/tz";
import { Status, type StatusTone } from "@/components/ui/Status";
import { FechaHoraSesion } from "@/app/pro/_components/FechaHoraSesion";
import {
  NewAppointment,
  type PacienteSelect,
} from "@/app/pro/_components/NewAppointment";
import type { AgendaAppointment, AgendaBlock } from "@/lib/queries/appointments";

export type CalendarView = "day" | "week" | "month";

/* --------------------------------------------------------- fechas util --- */

const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_PX = 48;
const GRID_H = (HOUR_END - HOUR_START) * HOUR_PX;
/**
 * Columna de horas. Se encoge con la pantalla en vez de robar sitio fijo a los
 * días: es lo que permite que las siete columnas quepan sin desplazamiento
 * horizontal incluso en un móvil. El mínimo es el ancho de "08:00" a 10px.
 */
const GUTTER = "clamp(2.5rem, 5vw, 3.5rem)";
const DURATIONS = [30, 45, 60, 90] as const;

/*
 * Este componente es cliente, pero Next también lo renderiza en el servidor
 * (UTC). Cualquier `getHours()`/`getDate()` daba una hora en el HTML inicial y
 * otra tras hidratar. Todo lo horario pasa por `lib/tz`; las celdas del
 * calendario son fechas sin zona ancladas a UTC (`parseYMD`/`formatYMD`).
 */

/** Día de calendario (en Madrid) al que pertenece una cita o un bloqueo. */
function dayOf(iso: string): string {
  return ymdInTZ(new Date(iso));
}
/** Minutos desde medianoche, en hora de Madrid. */
function minutesOfDay(iso: string): number {
  return minutesOfDayInTZ(new Date(iso));
}
/** Formatea una celda del calendario sin que la zona del proceso la desplace. */
function cellLabel(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString("es-ES", { timeZone: "UTC", ...opts });
}

/* -------------------------------------------------------------- estados --- */

const STATUS_LABEL: Record<string, string> = {
  scheduled: "sin confirmar",
  confirmed: "confirmada",
  cancelled: "cancelada",
  completed: "completada",
};
const ATTENDANCE_LABEL: Record<string, string> = {
  pending: "pendiente",
  attended: "acudió",
  no_show: "no acudió",
  late_cancel: "canceló tarde",
};
function statusTone(status: string): StatusTone {
  if (status === "confirmed") return "accent";
  if (status === "scheduled") return "warn";
  return "neutral"; // completed / cancelled
}
/**
 * Aspecto del bloque según el estado, con el mismo lenguaje que la agenda de
 * «Hoy»: confirmada en verde suave, sin confirmar sobre la hoja con borde
 * ámbar, y lo ya pasado hundido. Ni bordes laterales de color ni sombra al
 * pasar el ratón — la distinción la hacen el fondo y el texto, y el cambio de
 * fondo basta para decir que el bloque se puede pulsar.
 */
function statusClasses(status: string): string {
  switch (status) {
    case "confirmed":
      return "bg-accent-soft text-ink hover:bg-green-2";
    case "scheduled":
      return "border border-warning-line bg-surface text-ink hover:bg-warning-soft";
    default: // completed / cancelled
      return "bg-surface-muted text-ink-disabled hover:bg-surface-subtle";
  }
}
/** Lo ya pasado lleva el nombre tachado, además del fondo hundido. */
function esPasada(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

/* ---------------------------------------------------------------- tipos --- */

type Popup =
  | { kind: "appt"; appt: AgendaAppointment; x: number; y: number }
  | { kind: "block"; block: AgendaBlock; x: number; y: number };

/** Hueco pinchado en el calendario: día y, en día/semana, la hora. */
type NuevaCita = { day: string; time: string };
type OnNew = (day: string, time: string) => void;

export function AgendaCalendar({
  view,
  dateYMD,
  appointments,
  blocks,
  patients,
  defaultPatientId,
}: {
  view: CalendarView;
  dateYMD: string;
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
  patients: PacienteSelect[];
  defaultPatientId?: string;
}) {
  const router = useRouter();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [editing, setEditing] = useState<AgendaAppointment | null>(null);
  const [nueva, setNueva] = useState<NuevaCita | null>(null);
  const onNew: OnNew = (day, time) => {
    setPopup(null);
    setNueva({ day, time });
  };

  // "Hoy"/"ahora" fuera del render (pureza de React); solo tras montar.
  // El intervalo es necesario: sin él la línea roja se quedaba clavada en la
  // hora de carga, y una agenda suele estar abierta toda la jornada.
  const [today, setToday] = useState<string | null>(null);
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    function tick() {
      const n = new Date();
      setToday(todayYMD(n));
      setNowMin(minutesOfDayInTZ(n));
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Cerrar popup/modal con Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPopup(null);
        setEditing(null);
        setNueva(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openPopup(
    e: React.MouseEvent,
    payload: { kind: "appt"; appt: AgendaAppointment } | { kind: "block"; block: AgendaBlock },
  ) {
    e.stopPropagation();
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - 312));
    const y = Math.max(8, Math.min(e.clientY + 10, window.innerHeight - 280));
    setPopup({ ...payload, x, y });
  }

  const date = parseYMD(dateYMD);

  return (
    <div>
      {view === "month" ? (
        <MonthGrid
          date={date}
          appointments={appointments}
          blocks={blocks}
          todayYMD={today}
          onOpen={openPopup}
          onNew={onNew}
        />
      ) : (
        <TimeGrid
          days={view === "week" ? 7 : 1}
          date={date}
          appointments={appointments}
          blocks={blocks}
          todayYMD={today}
          nowMin={nowMin}
          onOpen={openPopup}
          onNew={onNew}
        />
      )}

      {/* Leyenda. Cada muestra lleva el mismo tratamiento que su bloque, no un
          punto de color aparte: así se reconoce sin tener que traducir. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-ink-3">
        <LegendSwatch className="bg-accent-soft" label="Confirmada" />
        <LegendSwatch
          className="border border-warning-line bg-surface"
          label="Sin confirmar"
        />
        <LegendSwatch className="bg-surface-muted" label="Realizada o cancelada" />
        <LegendSwatch className="hatch" label="Bloqueo" />
      </div>

      {/* Popup de vista previa */}
      {popup && (
        <>
          {/* Velo para cerrar pinchando fuera. Es comodidad de ratón y nada
              más: por teclado se cierra con Escape (ver el efecto de arriba),
              así que va oculto al lector de pantalla en vez de anunciarse como
              un control suelto sin nombre. */}
          <div aria-hidden className="fixed inset-0 z-30" onClick={() => setPopup(null)} />
          {/* Radio 12 y borde de 1 px, sin sombra: lo que separa el diálogo de
              lo que hay debajo es el borde, no una nube gris. */}
          <div
            role="dialog"
            className="fixed z-40 w-[19rem] rounded-3xl border border-line bg-surface p-4"
            style={{ left: popup.x, top: popup.y }}
          >
            {popup.kind === "appt" ? (
              <ApptPreview
                appt={popup.appt}
                onEdit={() => {
                  setEditing(popup.appt);
                  setPopup(null);
                }}
              />
            ) : (
              <BlockPreview
                block={popup.block}
                onDone={() => {
                  setPopup(null);
                  router.refresh();
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Nueva cita desde un hueco del calendario */}
      {nueva && (
        <NewAppointmentDialog
          key={`${nueva.day}T${nueva.time}`}
          day={nueva.day}
          time={nueva.time}
          patients={patients}
          defaultPatientId={defaultPatientId}
          onClose={() => setNueva(null)}
        />
      )}

      {/* Modal de edición */}
      {editing && (
        <EditModal
          key={editing.id}
          appt={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-3 w-4 rounded-xs ${className}`} />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------ vista mes --- */

function MonthGrid({
  date,
  appointments,
  blocks,
  todayYMD,
  onOpen,
  onNew,
}: {
  date: Date;
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
  todayYMD: string | null;
  onOpen: (
    e: React.MouseEvent,
    p: { kind: "appt"; appt: AgendaAppointment } | { kind: "block"; block: AgendaBlock },
  ) => void;
  onNew: OnNew;
}) {
  const first = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
  const gridStart = mondayOfYMD(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDaysYMD(gridStart, i));
  const month = date.getUTCMonth();

  const apptByDay = useMemo(() => {
    const m = new Map<string, AgendaAppointment[]>();
    for (const a of appointments) {
      const k = dayOf(a.starts_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [appointments]);

  const blockByDay = useMemo(() => {
    const m = new Map<string, AgendaBlock[]>();
    for (const b of blocks) {
      const k = dayOf(b.starts_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    }
    return m;
  }, [blocks]);

  return (
    <div className="card overflow-x-auto">
      {/* Sin ancho mínimo: el mes cabe entero a cualquier anchura. */}
      <div>
        <div className="grid grid-cols-7 border-b border-line bg-surface-subtle">
          {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[12px] font-medium text-ink-3"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-line">
          {cells.map((cell) => {
            const k = formatYMD(cell);
            const isToday = todayYMD === k;
            const inMonth = cell.getUTCMonth() === month;
            const dayAppts = apptByDay.get(k) ?? [];
            const dayBlocks = blockByDay.get(k) ?? [];
            const MAX = 3;
            const extra = dayAppts.length + dayBlocks.length - MAX;
            // Pinchar el fondo de la celda abre una cita nueva ese día, sin
            // hora: en el mes no hay a qué altura apuntar. El número y las
            // citas siguen haciendo lo suyo y no llegan hasta aquí.
            return (
              <div
                key={k}
                onClick={() => onNew(k, "")}
                title="Nueva cita este día"
                className={`min-h-[6.5rem] cursor-pointer p-1.5 ${inMonth ? "bg-surface" : "bg-surface-subtle"}`}
              >
                <Link
                  href={`/pro/agenda?view=day&date=${k}`}
                  onClick={(e) => e.stopPropagation()}
                  aria-current={isToday ? "date" : undefined}
                  className={`mb-1 inline-flex size-6 items-center justify-center rounded-xl text-[12px] transition-colors hover:bg-surface-muted ${
                    isToday
                      ? "bg-accent-soft font-semibold text-accent"
                      : inMonth
                        ? "font-medium text-ink"
                        : "text-ink-4"
                  }`}
                >
                  {cell.getUTCDate()}
                </Link>
                <div className="flex flex-col gap-0.5">
                  {dayBlocks.slice(0, 1).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={(e) => onOpen(e, { kind: "block", block: b })}
                      className="hatch w-full cursor-pointer truncate rounded-md px-1.5 py-px text-left text-[10.5px] text-ink-4"
                    >
                      Bloqueo{b.reason ? `, ${b.reason}` : ""}
                    </button>
                  ))}
                  {dayAppts.slice(0, MAX - Math.min(dayBlocks.length, 1)).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={(e) => onOpen(e, { kind: "appt", appt: a })}
                      className={`w-full cursor-pointer truncate rounded-md px-1.5 py-px text-left text-[10.5px] transition-colors ${statusClasses(a.status)}`}
                    >
                      {formatTime(a.starts_at)}{" "}
                      <span className={esPasada(a.status) ? "line-through" : "font-medium"}>
                        {a.patientName ?? "—"}
                      </span>
                    </button>
                  ))}
                  {extra > 0 && (
                    <Link
                      href={`/pro/agenda?view=day&date=${k}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-1.5 text-[10.5px] text-accent hover:underline"
                    >
                      {extra} más
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- vista día/semana --- */

type Placed = LayoutBox & { appt: AgendaAppointment };

/**
 * Coloca las citas de un día en carriles. El algoritmo vive en
 * `lib/appointment-layout.ts` para poder testearlo sin DOM.
 */
function placeDay(appts: AgendaAppointment[]): Placed[] {
  const byId = new Map(appts.map((a) => [a.id, a]));
  return layoutDay(
    appts.map((a) => ({
      id: a.id,
      startMin: minutesOfDay(a.starts_at),
      endMin: minutesOfDay(a.ends_at),
    })),
    { hourStart: HOUR_START, hourEnd: HOUR_END, hourPx: HOUR_PX },
  ).map((box) => ({ ...box, appt: byId.get(box.id)! }));
}

function TimeGrid({
  days,
  date,
  appointments,
  blocks,
  todayYMD,
  nowMin,
  onOpen,
  onNew,
}: {
  days: 1 | 7;
  date: Date;
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
  todayYMD: string | null;
  nowMin: number | null;
  onOpen: (
    e: React.MouseEvent,
    p: { kind: "appt"; appt: AgendaAppointment } | { kind: "block"; block: AgendaBlock },
  ) => void;
  onNew: OnNew;
}) {
  // Media hora bajo el puntero, para enseñar qué hueco se va a pedir antes
  // de pinchar. Solo cambia de estado al cruzar de una media hora a otra.
  const [hover, setHover] = useState<{ k: string; min: number } | null>(null);
  const start = days === 7 ? mondayOfYMD(date) : date;
  const cols = Array.from({ length: days }, (_, i) => addDaysYMD(start, i));
  const hours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i,
  );

  const apptByDay = useMemo(() => {
    const m = new Map<string, AgendaAppointment[]>();
    for (const a of appointments) {
      const k = dayOf(a.starts_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [appointments]);

  return (
    <div className="card overflow-x-auto">
      {/* Sin ancho mínimo a ninguna anchura: el calendario cabe siempre entero y
          nunca hay que desplazarlo en horizontal. La columna de horas se encoge
          con la pantalla (`clamp`) para dejar sitio a los días. */}
      <div>
        {/* Cabecera de días */}
        <div
          className="grid border-b border-line"
          style={{ gridTemplateColumns: `${GUTTER} repeat(${days}, minmax(0, 1fr))` }}
        >
          <div />
          {cols.map((c) => {
            const k = formatYMD(c);
            const isToday = todayYMD === k;
            return (
              <Link
                key={k}
                href={`/pro/agenda?view=day&date=${k}`}
                aria-current={isToday ? "date" : undefined}
                className={`border-l border-line px-2 py-2 text-center transition-colors hover:bg-surface-muted ${
                  isToday ? "bg-accent-soft" : ""
                }`}
              >
                <span
                  className={`block truncate text-[12.5px] capitalize ${isToday ? "font-semibold text-accent" : "text-ink-2"}`}
                >
                  {cellLabel(c, {
                    weekday: "short",
                    day: "numeric",
                    ...(days === 1 ? { month: "long" } : {}),
                  })}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Cuerpo */}
        <div
          className="grid"
          style={{ gridTemplateColumns: `${GUTTER} repeat(${days}, minmax(0, 1fr))` }}
        >
          {/* Columna de horas */}
          <div className="relative" style={{ height: GRID_H }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 text-[11px] text-ink-4"
                style={{ top: (h - HOUR_START) * HOUR_PX - 6 }}
              >
                {h > HOUR_START ? `${String(h).padStart(2, "0")}:00` : ""}
              </span>
            ))}
          </div>
          {/* Columnas de días */}
          {cols.map((c) => {
            const k = formatYMD(c);
            const isToday = todayYMD === k;
            const placed = placeDay(apptByDay.get(k) ?? []);
            // Instantes reales de las 07:00 y las 21:00 EN MADRID de ese día.
            // Con `c.getTime() + 7h` se obtenían las 07:00 UTC y los bloqueos
            // se pintaban desplazados una o dos horas.
            const cy = c.getUTCFullYear();
            const cm = c.getUTCMonth() + 1;
            const cd = c.getUTCDate();
            const dayStartMs = fromWallClock(cy, cm, cd, HOUR_START, 0).getTime();
            const dayEndMs = fromWallClock(cy, cm, cd, HOUR_END, 0).getTime();
            const dayBlocks = blocks
              .map((b) => {
                const s = Math.max(new Date(b.starts_at).getTime(), dayStartMs);
                const e = Math.min(new Date(b.ends_at).getTime(), dayEndMs);
                return { b, s, e };
              })
              .filter((x) => x.e > x.s);
            return (
              <div
                key={k}
                className={`relative cursor-pointer border-l border-line ${isToday ? "bg-accent-soft/30" : ""}`}
                style={{ height: GRID_H }}
                onClick={(ev) => onNew(k, hhmm(slotAt(ev)))}
                onMouseMove={(ev) => {
                  // Sobre una cita o un bloqueo no se ofrece hueco: ese clic
                  // abre lo que hay, no una cita nueva.
                  if ((ev.target as HTMLElement).closest("button")) {
                    if (hover) setHover(null);
                    return;
                  }
                  const min = slotAt(ev);
                  if (hover?.k !== k || hover.min !== min) setHover({ k, min });
                }}
                onMouseLeave={() => setHover(null)}
              >
                {/* Líneas de hora */}
                {hours.map((h) =>
                  h > HOUR_START ? (
                    <div
                      key={h}
                      aria-hidden
                      className="absolute inset-x-0 border-t border-line-soft"
                      style={{ top: (h - HOUR_START) * HOUR_PX }}
                    />
                  ) : null,
                )}
                {/* Hueco bajo el puntero */}
                {hover?.k === k && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0.5 rounded-md border border-dashed border-line-strong px-1.5 py-0.5 text-[10.5px] text-ink-3"
                    style={{
                      top: ((hover.min - HOUR_START * 60) / 60) * HOUR_PX,
                      height: HOUR_PX / 2,
                    }}
                  >
                    + {hhmm(hover.min)}
                  </div>
                )}
                {/* Bloqueos: trama, no gris plano. */}
                {dayBlocks.map(({ b, s, e }) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(ev) => onOpen(ev, { kind: "block", block: b })}
                    className="hatch absolute inset-x-0.5 cursor-pointer rounded-md px-1.5 text-left text-[10.5px] text-ink-4"
                    style={{
                      top: ((s - dayStartMs) / 3600_000) * HOUR_PX,
                      height: Math.max(((e - s) / 3600_000) * HOUR_PX, 14),
                    }}
                  >
                    Bloqueo
                  </button>
                ))}
                {/* Citas */}
                {placed.map(({ appt, top, height, leftPct, widthPct }) => (
                  <button
                    key={appt.id}
                    type="button"
                    onClick={(ev) => onOpen(ev, { kind: "appt", appt })}
                    className={`absolute cursor-pointer overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors ${statusClasses(appt.status)}`}
                    style={{
                      top,
                      height,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  >
                    <span
                      className={`block truncate ${esPasada(appt.status) ? "line-through" : "font-semibold"}`}
                    >
                      {appt.patientName ?? "—"}
                    </span>
                    {height >= 34 && (
                      <span className="block truncate text-[10.5px]">
                        {formatTime(appt.starts_at)} – {formatTime(appt.ends_at)}
                        {/* El color no puede ir solo: el bloque ámbar dice
                            además, con palabras, qué le falta a la cita. */}
                        {appt.status === "scheduled" && (
                          <span className="text-warning-ink">, sin confirmar</span>
                        )}
                      </span>
                    )}
                  </button>
                ))}
                {/* Línea de "ahora" */}
                {isToday &&
                  nowMin != null &&
                  nowMin >= HOUR_START * 60 &&
                  nowMin <= HOUR_END * 60 && (
                    <div
                      aria-hidden
                      className="absolute inset-x-0 z-10"
                      style={{ top: ((nowMin - HOUR_START * 60) / 60) * HOUR_PX }}
                    >
                      <div className="h-0.5 bg-danger" />
                      <div className="-mt-[5px] ml-0 size-2 rounded-full bg-danger" />
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Media hora (en minutos desde medianoche) bajo el puntero en una columna. */
function slotAt(ev: React.MouseEvent<HTMLElement>): number {
  const y = ev.clientY - ev.currentTarget.getBoundingClientRect().top;
  const min = HOUR_START * 60 + Math.floor((y / HOUR_PX) * 2) * 30;
  return Math.min(Math.max(min, HOUR_START * 60), HOUR_END * 60 - 30);
}
function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------- diálogo de nueva cita --- */

function NewAppointmentDialog({
  day,
  time,
  patients,
  defaultPatientId,
  onClose,
}: {
  day: string;
  time: string;
  patients: PacienteSelect[];
  defaultPatientId?: string;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4"
      onClick={onClose}
    >
      {/* Mismo diálogo que «Modificar cita»: radio 12, borde y velo, sin
          sombra, y desplazable porque el formulario no cabe en un móvil. */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Nueva cita"
        aria-modal
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold">Nueva cita</h3>
          <button type="button" onClick={onClose} className="btn-subtle btn-sm">
            Cerrar
          </button>
        </div>
        <NewAppointment
          patients={patients}
          defaultPatientId={defaultPatientId}
          initialDay={day}
          initialTime={time}
          enDialogo
          onCreated={onClose}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------- popup de cita --- */

function ApptPreview({
  appt,
  onEdit,
}: {
  appt: AgendaAppointment;
  onEdit: () => void;
}) {
  const day = new Date(appt.starts_at).toLocaleDateString("es-ES", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{appt.patientName ?? "Sin nombre"}</p>
        <Status tone={statusTone(appt.status)}>
          {STATUS_LABEL[appt.status] ?? appt.status}
        </Status>
      </div>
      <p className="mt-1 text-sm text-ink-2 capitalize">{day}</p>
      <p className="text-sm text-ink-2">
        {formatTime(appt.starts_at)} – {formatTime(appt.ends_at)}
        {appt.attendance !== "pending" && (
          <span className="ml-2 text-[12.5px] text-ink-3">
            {ATTENDANCE_LABEL[appt.attendance] ?? appt.attendance}
          </span>
        )}
      </p>
      {appt.notes && (
        <p className="mt-2 line-clamp-3 rounded-md bg-surface-muted p-2.5 text-[12.5px] text-ink-2">
          {appt.notes}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs">
        {/* Se revalida el esquema al pintar, no solo al guardar: cubre lo que ya
            estuviera en BD antes de la validación en la server action. */}
        {safeExternalUrl(appt.video_link) && (
          <a
            href={safeExternalUrl(appt.video_link)!}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Videollamada
          </a>
        )}
        <a
          href={`/appointments/${appt.id}/ics`}
          className="text-ink-3 underline underline-offset-2 hover:text-ink"
        >
          .ics
        </a>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
        <Link href={`/pro/patients/${appt.patient_id}`} className="btn-ghost h-7 text-xs">
          Ver paciente
        </Link>
        <button type="button" onClick={onEdit} className="btn-primary h-7 text-xs">
          Modificar cita
        </button>
      </div>
    </div>
  );
}

function BlockPreview({
  block,
  onDone,
}: {
  block: AgendaBlock;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const fmt = (iso: string) => formatDateTime(iso);
  return (
    <div>
      <p className="text-sm font-semibold">Bloqueo</p>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <p className="mt-1 text-sm text-ink-2">
        De {fmt(block.starts_at)} a {fmt(block.ends_at)}
      </p>
      {block.reason && <p className="mt-1 text-sm text-ink-2">{block.reason}</p>}
      <div className="mt-3 border-t border-line pt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try { await callAction(deleteBlockAction, block.id); onDone(); }
              catch (e) { setError(actionErrorMessage(e)); }
            })
          }
          className="btn-danger h-7 text-xs"
        >
          {pending ? "…" : "Eliminar bloqueo"}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- modal de edición --- */

function EditModal({
  appt,
  onClose,
}: {
  appt: AgendaAppointment;
  onClose: () => void;
}) {
  const dialogRef = useDialogFocus(onClose);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialMin = Math.round(
    (new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) /
      60_000,
  );
  const initialPreset = (DURATIONS as readonly number[]).includes(initialMin);
  const inicial = toDatetimeLocal(appt.starts_at);
  const [day, setDay] = useState(inicial.slice(0, 10));
  const [time, setTime] = useState(inicial.slice(11, 16));
  const [duration, setDuration] = useState(initialPreset ? initialMin : 60);
  const [customMode, setCustomMode] = useState(!initialPreset);
  const [customMin, setCustomMin] = useState(String(initialMin || 60));
  const [videoLink, setVideoLink] = useState(appt.video_link ?? "");
  const [notes, setNotes] = useState(appt.notes ?? "");
  const [attendance, setAttendance] = useState(appt.attendance);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");
  /** Aviso informativo: la acción se ha hecho, pero hay algo que contar. */
  const [aviso, setAviso] = useState("");
  const esDeSerie =
    appt.parent_appointment_id != null || appt.recurrence_freq !== "none";

  const minutes = customMode
    ? Math.max(5, parseInt(customMin, 10) || 0)
    : duration;

  function clearConflict() {
    if (conflict) setConflict("");
  }

  function run(fn: () => Promise<void | { warning?: string }>, close = true) {
    setError("");
    startTransition(async () => {
      try {
        const result = await fn();
        router.refresh();
        if (result?.warning) setAviso(result.warning);
        else if (close) onClose();
      } catch (e) {
        setError(actionErrorMessage(e));
      }
    });
  }

  function save(force = false) {
    if (!day || !time) {
      setError("Elige el día y la hora de la sesión.");
      return;
    }
    if (!minutes || minutes < 5) {
      setError("La duración debe ser de al menos 5 minutos.");
      return;
    }
    // El valor del input se interpreta como hora de Madrid, no como hora del
    // navegador: es la inversa exacta de `toDatetimeLocal`.
    const startDate = fromDatetimeLocal(`${day}T${time}`);
    if (!startDate) {
      setError("La fecha y hora no son válidas.");
      return;
    }
    setError("");
    const endsAt = new Date(startDate.getTime() + minutes * 60_000).toISOString();
    startTransition(async () => {
      try {
        const res = await callAction(updateAppointmentAction, {
          id: appt.id,
          patientId: appt.patient_id,
          startsAt: startDate.toISOString(),
          endsAt,
          videoLink,
          notes,
          force,
        });
        if (!res.ok) {
          setConflict(res.conflict);
          return;
        }
        if (attendance !== appt.attendance) {
          const res = await callAction(setAttendanceAction, appt.id, attendance);
          if (res.warning) {
            // El modal NO se cierra: si se cerrara, el aviso se perdería y el
            // profesional se quedaría pensando que el pago se ha borrado.
            setAviso(res.warning);
            router.refresh();
            return;
          }
        }
        router.refresh();
        onClose();
      } catch (e) {
        setError(actionErrorMessage(e));
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4"
      onClick={onClose}
    >
      {/* Radio 12, que es el del diálogo, y no el 10 de la tarjeta. No usa
          `.modal` porque esa clase lleva `overflow-hidden` y aquí hace falta
          `overflow-y-auto`: el formulario es más alto que la pantalla en un
          móvil. Lo que lo separa del fondo es el borde y el velo, no sombra. */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Modificar cita"
        aria-modal
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Modificar cita</h3>
            <p className="text-sm text-ink-2">{appt.patientName ?? "Sin nombre"}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-subtle btn-sm">
            Cerrar
          </button>
        </div>

        {/* La edición afecta SOLO a esta ocurrencia. Se dice de forma explícita
            porque antes no se decía y mover la cita madre de una serie dejaba
            las repeticiones en el horario antiguo, sin aviso. Editar la serie
            completa está pendiente. */}
        {esDeSerie && (
          <p className="mt-3 rounded-md bg-info-soft p-2.5 text-[12.5px] text-info">
            Esta cita forma parte de una serie. Los cambios se aplican{" "}
            <strong className="font-semibold">solo a esta cita</strong>; las
            demás repeticiones se quedan como están.
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="field-label">Duración</span>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => {
                const active = !customMode && duration === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setCustomMode(false);
                      setDuration(d);
                      clearConflict();
                    }}
                    className={`rounded-lg border px-3 py-1 text-sm font-medium transition-colors duration-150 ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line-strong bg-canvas text-ink-2 hover:bg-wash hover:text-ink"
                    }`}
                  >
                    {d} min
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setCustomMode(true);
                  clearConflict();
                }}
                className={`rounded-lg border px-3 py-1 text-sm font-medium transition-colors duration-150 ${
                  customMode
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line-strong bg-canvas text-ink-2 hover:bg-wash hover:text-ink"
                }`}
              >
                Personalizado
              </button>
            </div>
            {customMode && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={customMin}
                  onChange={(e) => {
                    setCustomMin(e.target.value);
                    clearConflict();
                  }}
                  className="field w-24"
                  aria-label="Duración personalizada en minutos"
                />
                <span className="text-sm text-ink-2">minutos</span>
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <FechaHoraSesion
              day={day}
              time={time}
              minutes={minutes}
              excludeId={appt.id}
              onDay={(v) => {
                setDay(v);
                clearConflict();
              }}
              onTime={(v) => {
                setTime(v);
                clearConflict();
              }}
            />
          </div>
          <label className="block sm:col-span-2">
            <span className="field-label">Link de videollamada</span>
            <input
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              placeholder="https://meet…"
              className="field"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="field-label">Notas</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="field"
            />
          </label>
          <label className="block">
            <span className="field-label">Asistencia</span>
            <select
              value={attendance}
              onChange={(e) =>
                setAttendance(
                  e.target.value as "pending" | "attended" | "no_show" | "late_cancel",
                )
              }
              className="field"
            >
              <option value="pending">Pendiente</option>
              <option value="attended">Acudió</option>
              <option value="no_show">No acudió</option>
              <option value="late_cancel">Canceló tarde</option>
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        )}

        {aviso && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-2xl border border-info/30 bg-info-soft p-3 text-sm text-info"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <div>
              <p>{aviso}</p>
              <Link
                href={`/pro/patients/${appt.patient_id}?tab=pagos`}
                className="mt-1 inline-block font-medium underline underline-offset-2"
              >
                Ir a Pagos de la ficha
              </Link>
            </div>
          </div>
        )}

        {conflict && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <p>{conflict}</p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <div className="flex gap-1">
            {appt.status !== "cancelled" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => callAction(cancelAppointmentAction, appt.id))}
                className="btn-subtle btn-sm text-warn hover:text-warn"
              >
                Cancelar cita
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm("¿Eliminar esta cita definitivamente?")) {
                  run(() => callAction(deleteAppointmentAction, appt.id));
                }
              }}
              className="btn-danger btn-sm"
            >
              Eliminar
            </button>
          </div>
          {conflict ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConflict("")}
                className="btn-subtle btn-sm"
              >
                Revisar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => save(true)}
                className="btn-primary"
              >
                {pending ? "Guardando…" : "Guardar de todos modos"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => save(false)}
              className="btn-primary"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
