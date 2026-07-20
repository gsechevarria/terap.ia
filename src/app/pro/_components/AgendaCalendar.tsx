"use client";

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
import { toDatetimeLocal } from "@/lib/format";
import { Status, type StatusTone } from "@/components/ui/Status";
import type { AgendaAppointment, AgendaBlock } from "@/lib/queries/appointments";

export type CalendarView = "day" | "week" | "month";

/* --------------------------------------------------------- fechas util --- */

const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_PX = 48;
const GRID_H = (HOUR_END - HOUR_START) * HOUR_PX;
const DURATIONS = [30, 45, 60, 90] as const;

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/* -------------------------------------------------------------- estados --- */

const STATUS_LABEL: Record<string, string> = {
  scheduled: "por confirmar",
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
  if (status === "scheduled") return "info";
  return "neutral"; // completed / cancelled
}
/** Colores del evento según estado (borde izquierdo + fondo suave). */
function statusClasses(status: string): string {
  switch (status) {
    case "confirmed":
      return "border-accent bg-accent-soft text-accent";
    case "scheduled":
      return "border-info bg-info-soft text-info";
    case "cancelled":
      return "border-line bg-panel text-ink-3 line-through";
    default: // completed
      return "border-line bg-panel text-ink-2";
  }
}

const BLOCK_STRIPES = {
  backgroundImage:
    "repeating-linear-gradient(45deg, var(--wash-2) 0 4px, transparent 4px 10px)",
} as const;

/* ---------------------------------------------------------------- tipos --- */

type Popup =
  | { kind: "appt"; appt: AgendaAppointment; x: number; y: number }
  | { kind: "block"; block: AgendaBlock; x: number; y: number };

export function AgendaCalendar({
  view,
  dateYMD,
  appointments,
  blocks,
}: {
  view: CalendarView;
  dateYMD: string;
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
}) {
  const router = useRouter();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [editing, setEditing] = useState<AgendaAppointment | null>(null);

  // "Hoy"/"ahora" fuera del render (pureza de React); solo tras montar.
  const [todayYMD, setTodayYMD] = useState<string | null>(null);
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const n = new Date();
      if (!active) return;
      setTodayYMD(ymd(n));
      setNowMin(n.getHours() * 60 + n.getMinutes());
    })();
    return () => {
      active = false;
    };
  }, []);

  // Cerrar popup/modal con Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPopup(null);
        setEditing(null);
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
          todayYMD={todayYMD}
          onOpen={openPopup}
        />
      ) : (
        <TimeGrid
          days={view === "week" ? 7 : 1}
          date={date}
          appointments={appointments}
          blocks={blocks}
          todayYMD={todayYMD}
          nowMin={nowMin}
          onOpen={openPopup}
        />
      )}

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        <LegendDot className="bg-info" label="Por confirmar" />
        <LegendDot className="bg-accent" label="Confirmada" />
        <LegendDot className="bg-ink-3" label="Completada / cancelada" />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border border-line" style={BLOCK_STRIPES} />
          Bloqueo
        </span>
      </div>

      {/* Popup de vista previa */}
      {popup && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setPopup(null)} />
          <div
            role="dialog"
            className="card fixed z-40 w-[19rem] p-4 shadow-[0_16px_48px_-16px_rgba(15,15,15,0.35)]"
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

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${className}`} />
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
}: {
  date: Date;
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
  todayYMD: string | null;
  onOpen: (
    e: React.MouseEvent,
    p: { kind: "appt"; appt: AgendaAppointment } | { kind: "block"; block: AgendaBlock },
  ) => void;
}) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = date.getMonth();

  const apptByDay = useMemo(() => {
    const m = new Map<string, AgendaAppointment[]>();
    for (const a of appointments) {
      const k = ymd(new Date(a.starts_at));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [appointments]);

  const blockByDay = useMemo(() => {
    const m = new Map<string, AgendaBlock[]>();
    for (const b of blocks) {
      const k = ymd(new Date(b.starts_at));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    }
    return m;
  }, [blocks]);

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-line">
          {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-center text-[11px] font-medium text-ink-3"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-line">
          {cells.map((cell) => {
            const k = ymd(cell);
            const isToday = todayYMD === k;
            const inMonth = cell.getMonth() === month;
            const dayAppts = apptByDay.get(k) ?? [];
            const dayBlocks = blockByDay.get(k) ?? [];
            const MAX = 3;
            const extra = dayAppts.length + dayBlocks.length - MAX;
            return (
              <div
                key={k}
                className={`min-h-[6.5rem] p-1 ${inMonth ? "bg-canvas" : "bg-panel"}`}
              >
                <Link
                  href={`/pro/agenda?view=day&date=${k}`}
                  className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs transition-colors hover:bg-wash ${
                    isToday
                      ? "bg-accent font-semibold text-accent-ink hover:bg-accent"
                      : inMonth
                        ? "font-medium text-ink"
                        : "text-ink-3"
                  }`}
                >
                  {cell.getDate()}
                </Link>
                <div className="flex flex-col gap-0.5">
                  {dayBlocks.slice(0, 1).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={(e) => onOpen(e, { kind: "block", block: b })}
                      className="w-full cursor-pointer truncate rounded-sm border border-line px-1 py-px text-left text-[10px] text-ink-2"
                      style={BLOCK_STRIPES}
                    >
                      Bloqueo{b.reason ? ` · ${b.reason}` : ""}
                    </button>
                  ))}
                  {dayAppts.slice(0, MAX - Math.min(dayBlocks.length, 1)).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={(e) => onOpen(e, { kind: "appt", appt: a })}
                      className={`w-full cursor-pointer truncate rounded-sm border-l-2 px-1 py-px text-left text-[10px] font-medium ${statusClasses(a.status)}`}
                    >
                      {timeLabel(a.starts_at)} {a.patientName ?? "—"}
                    </button>
                  ))}
                  {extra > 0 && (
                    <Link
                      href={`/pro/agenda?view=day&date=${k}`}
                      className="px-1 text-[10px] text-ink-3 hover:text-ink"
                    >
                      +{extra} más
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

type Placed = {
  appt: AgendaAppointment;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
};

/** Coloca las citas de un día en carriles para resolver solapes. */
function layoutDay(appts: AgendaAppointment[]): Placed[] {
  const evs = appts
    .map((a) => {
      const s = Math.max(minutesOfDay(a.starts_at), HOUR_START * 60);
      const e = Math.min(
        Math.max(minutesOfDay(a.ends_at), s + 25),
        HOUR_END * 60,
      );
      return { a, s, e };
    })
    .filter((ev) => ev.e > ev.s)
    .sort((x, y) => x.s - y.s);

  const laneEnds: number[] = [];
  const withLane = evs.map((ev) => {
    let lane = laneEnds.findIndex((end) => end <= ev.s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = ev.e;
    return { ...ev, lane };
  });
  const lanes = Math.max(1, laneEnds.length);

  return withLane.map(({ a, s, e, lane }) => ({
    appt: a,
    top: ((s - HOUR_START * 60) / 60) * HOUR_PX,
    height: Math.max(((e - s) / 60) * HOUR_PX - 2, 18),
    leftPct: (lane / lanes) * 100,
    widthPct: 100 / lanes,
  }));
}

function TimeGrid({
  days,
  date,
  appointments,
  blocks,
  todayYMD,
  nowMin,
  onOpen,
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
}) {
  const start = days === 7 ? mondayOf(date) : date;
  const cols = Array.from({ length: days }, (_, i) => addDays(start, i));
  const hours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i,
  );

  const apptByDay = useMemo(() => {
    const m = new Map<string, AgendaAppointment[]>();
    for (const a of appointments) {
      const k = ymd(new Date(a.starts_at));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [appointments]);

  return (
    <div className="card overflow-x-auto">
      <div className={days === 7 ? "min-w-[860px]" : "min-w-[420px]"}>
        {/* Cabecera de días */}
        <div
          className="grid border-b border-line"
          style={{ gridTemplateColumns: `3.5rem repeat(${days}, 1fr)` }}
        >
          <div />
          {cols.map((c) => {
            const k = ymd(c);
            const isToday = todayYMD === k;
            return (
              <Link
                key={k}
                href={`/pro/agenda?view=day&date=${k}`}
                className="border-l border-line px-2 py-2 text-center transition-colors hover:bg-wash"
              >
                <span
                  className={`text-xs capitalize ${isToday ? "font-semibold text-accent" : "text-ink-2"}`}
                >
                  {c.toLocaleDateString("es-ES", {
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
          style={{ gridTemplateColumns: `3.5rem repeat(${days}, 1fr)` }}
        >
          {/* Columna de horas */}
          <div className="relative" style={{ height: GRID_H }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 text-[10px] text-ink-3"
                style={{ top: (h - HOUR_START) * HOUR_PX - 6 }}
              >
                {h > HOUR_START ? `${String(h).padStart(2, "0")}:00` : ""}
              </span>
            ))}
          </div>
          {/* Columnas de días */}
          {cols.map((c) => {
            const k = ymd(c);
            const isToday = todayYMD === k;
            const placed = layoutDay(apptByDay.get(k) ?? []);
            const dayStartMs = c.getTime() + HOUR_START * 3600_000;
            const dayEndMs = c.getTime() + HOUR_END * 3600_000;
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
                className={`relative border-l border-line ${isToday ? "bg-accent-soft/20" : ""}`}
                style={{ height: GRID_H }}
              >
                {/* Líneas de hora */}
                {hours.map((h) =>
                  h > HOUR_START ? (
                    <div
                      key={h}
                      aria-hidden
                      className="absolute inset-x-0 border-t border-line/70"
                      style={{ top: (h - HOUR_START) * HOUR_PX }}
                    />
                  ) : null,
                )}
                {/* Bloqueos */}
                {dayBlocks.map(({ b, s, e }) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(ev) => onOpen(ev, { kind: "block", block: b })}
                    className="absolute inset-x-0.5 cursor-pointer rounded-sm border border-line text-[10px] text-ink-2"
                    style={{
                      top: ((s - dayStartMs) / 3600_000) * HOUR_PX,
                      height: Math.max(((e - s) / 3600_000) * HOUR_PX, 14),
                      ...BLOCK_STRIPES,
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
                    className={`absolute cursor-pointer overflow-hidden rounded-sm border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight font-medium transition-shadow hover:shadow-[0_4px_12px_-4px_rgba(15,15,15,0.3)] ${statusClasses(appt.status)}`}
                    style={{
                      top,
                      height,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  >
                    <span className="block truncate">
                      {appt.patientName ?? "—"}
                    </span>
                    {height >= 34 && (
                      <span className="block truncate text-[10px] opacity-80">
                        {timeLabel(appt.starts_at)} – {timeLabel(appt.ends_at)}
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
                      <div className="h-px bg-danger" />
                      <div className="-mt-[3px] ml-0 size-1.5 rounded-full bg-danger" />
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

/* ------------------------------------------------------- popup de cita --- */

function ApptPreview({
  appt,
  onEdit,
}: {
  appt: AgendaAppointment;
  onEdit: () => void;
}) {
  const day = new Date(appt.starts_at).toLocaleDateString("es-ES", {
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
        {timeLabel(appt.starts_at)} – {timeLabel(appt.ends_at)}
        {appt.attendance !== "pending" && (
          <span className="ml-2 text-xs text-ink-3">
            · {ATTENDANCE_LABEL[appt.attendance] ?? appt.attendance}
          </span>
        )}
      </p>
      {appt.notes && (
        <p className="mt-2 line-clamp-3 rounded bg-panel p-2 text-xs text-ink-2">
          {appt.notes}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs">
        {appt.video_link && (
          <a
            href={appt.video_link}
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
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <div>
      <p className="text-sm font-semibold">Bloqueo</p>
      <p className="mt-1 text-sm text-ink-2">
        {fmt(block.starts_at)} → {fmt(block.ends_at)}
      </p>
      {block.reason && <p className="mt-1 text-sm text-ink-2">{block.reason}</p>}
      <div className="mt-3 border-t border-line pt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteBlockAction(block.id);
              onDone();
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialMin = Math.round(
    (new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) /
      60_000,
  );
  const initialPreset = (DURATIONS as readonly number[]).includes(initialMin);
  const [start, setStart] = useState(toDatetimeLocal(appt.starts_at));
  const [duration, setDuration] = useState(initialPreset ? initialMin : 60);
  const [customMode, setCustomMode] = useState(!initialPreset);
  const [customMin, setCustomMin] = useState(String(initialMin || 60));
  const [videoLink, setVideoLink] = useState(appt.video_link ?? "");
  const [notes, setNotes] = useState(appt.notes ?? "");
  const [attendance, setAttendance] = useState(appt.attendance);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");

  const minutes = customMode
    ? Math.max(5, parseInt(customMin, 10) || 0)
    : duration;

  function clearConflict() {
    if (conflict) setConflict("");
  }

  function run(fn: () => Promise<void>, close = true) {
    setError("");
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
        if (close) onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error.");
      }
    });
  }

  function save(force = false) {
    if (!start) {
      setError("Indica la fecha y hora de la sesión.");
      return;
    }
    if (!minutes || minutes < 5) {
      setError("La duración debe ser de al menos 5 minutos.");
      return;
    }
    setError("");
    const startDate = new Date(start);
    const endsAt = new Date(startDate.getTime() + minutes * 60_000).toISOString();
    startTransition(async () => {
      try {
        const res = await updateAppointmentAction({
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
          await setAttendanceAction(appt.id, attendance);
        }
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        className="card w-full max-w-md p-6"
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="field-label">Fecha y hora de la sesión</span>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                clearConflict();
              }}
              className="field"
            />
          </label>
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
                    className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors duration-150 ${
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
                className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors duration-150 ${
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
          <p className="mt-3 rounded bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        )}

        {conflict && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
            <p>{conflict}</p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <div className="flex gap-1">
            {appt.status !== "cancelled" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => cancelAppointmentAction(appt.id))}
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
                  run(() => deleteAppointmentAction(appt.id));
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
