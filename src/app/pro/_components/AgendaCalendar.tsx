"use client";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { callAction } from "@/lib/action-result";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteBlockAction } from "@/lib/actions/appointments";
import { formatDateTime, formatTime } from "@/lib/format";
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
import { EditarCitaDialog } from "@/app/pro/_components/EditarCita";
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
        <EditarCitaDialog
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
          Añadir al calendario
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

