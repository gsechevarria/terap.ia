"use client";

import { useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { DateField } from "@/components/ui/DateField";
import { getDayBusyAction, type FranjaOcupada } from "@/lib/actions/appointments";
import { formatTime } from "@/lib/format";
import { TZ, fromWallClock, ymdParts } from "@/lib/tz";

/**
 * Franjas de media hora que se ofrecen de un clic. Son las de la rejilla de la
 * agenda (07:00-21:00) menos la primera y la última hora, que casi nunca se
 * usan; cualquier otra hora se escribe en «Otra hora».
 */
const FRANJAS: string[] = [];
for (let min = 8 * 60; min <= 20 * 60 + 30; min += 30) {
  FRANJAS.push(`${String(Math.floor(min / 60)).padStart(2, "0")}:${min % 60 === 0 ? "00" : "30"}`);
}
const MANANA = FRANJAS.filter((h) => h < "14:00");
const TARDE = FRANJAS.filter((h) => h >= "14:00");

/** Instante real de un día + hora de pared en Madrid, o null si falta algo. */
function instante(day: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = ymdParts(day);
  const date = fromWallClock(y, m, d, Number(time.slice(0, 2)), Number(time.slice(3, 5)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Día + hora de la sesión. Sustituye al `datetime-local` nativo, que obligaba a
 * teclear la fecha a ciegas: aquí se elige el día en el calendario del sistema
 * y la hora en una rejilla que ya enseña qué está ocupado ese día con la
 * duración elegida.
 *
 * La ocupación es una ayuda para elegir, no la barrera. Una franja ocupada no
 * se ofrece de un clic, pero «Otra hora» deja escribirla, y al guardar el
 * servidor vuelve a comprobar los solapes —de la serie entera— y pide
 * confirmación como hasta ahora.
 */
export function FechaHoraSesion({
  day,
  time,
  minutes,
  onDay,
  onTime,
  excludeId,
  version = 0,
}: {
  day: string;
  time: string;
  minutes: number;
  onDay: (day: string) => void;
  onTime: (time: string) => void;
  /** Cita que se está editando: no se solapa consigo misma. */
  excludeId?: string;
  /** Se incrementa tras crear una cita para volver a pedir la ocupación. */
  version?: number;
}) {
  const clave = `${day}#${version}`;
  const [ocupacion, setOcupacion] = useState<{
    clave: string;
    franjas: FranjaOcupada[] | null;
  }>({ clave: "", franjas: null });

  useEffect(() => {
    if (!day) return;
    let vivo = true;
    getDayBusyAction(day).then(
      (r) => {
        if (vivo) setOcupacion({ clave, franjas: r.success ? r.data : null });
      },
      () => {
        if (vivo) setOcupacion({ clave, franjas: null });
      },
    );
    return () => {
      vivo = false;
    };
  }, [day, clave]);

  const cargando = day !== "" && ocupacion.clave !== clave;
  const franjas = useMemo(
    () =>
      ocupacion.clave === clave
        ? (ocupacion.franjas ?? []).filter((f) => f.id !== excludeId)
        : [],
    [ocupacion, clave, excludeId],
  );
  const sinDatos = day !== "" && !cargando && ocupacion.franjas === null;

  /** Primera cita o bloqueo con el que chocaría una sesión a esa hora. */
  function choque(hora: string): FranjaOcupada | null {
    const inicio = instante(day, hora);
    if (!inicio) return null;
    const fin = inicio.getTime() + minutes * 60_000;
    return (
      franjas.find(
        (f) =>
          new Date(f.start).getTime() < fin &&
          new Date(f.end).getTime() > inicio.getTime(),
      ) ?? null
    );
  }

  const inicio = instante(day, time);
  const choqueActual = time ? choque(time) : null;
  const resumen = inicio
    ? `${inicio.toLocaleDateString("es-ES", {
        timeZone: TZ,
        weekday: "long",
        day: "numeric",
        month: "long",
      })} · ${formatTime(inicio.toISOString())} – ${formatTime(
        new Date(inicio.getTime() + minutes * 60_000).toISOString(),
      )}`
    : null;

  function grupo(titulo: string, horas: string[]) {
    return (
      <div>
        <p className="mb-1 text-[11.5px] font-medium text-ink-3">{titulo}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {horas.map((h) => {
            const hit = day && !cargando ? choque(h) : null;
            const activa = time === h;
            const detalle = hit
              ? `${hit.label}, ${formatTime(hit.start)} – ${formatTime(hit.end)}`
              : "";
            return (
              <button
                key={h}
                type="button"
                onClick={() => onTime(h)}
                disabled={!day || (hit != null && !activa)}
                aria-pressed={activa}
                aria-label={hit ? `${h}, ocupado: ${detalle}` : h}
                title={hit ? `Ocupado: ${detalle}` : undefined}
                className={`rounded-lg border px-0 py-1 text-[13px] font-medium transition-colors duration-150 disabled:cursor-not-allowed ${
                  activa
                    ? "border-accent bg-accent-soft text-accent"
                    : hit
                      ? "border-line bg-surface-muted text-ink-disabled line-through"
                      : "border-line-strong bg-canvas text-ink-2 hover:bg-wash hover:text-ink disabled:opacity-50 disabled:hover:bg-canvas"
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <DateField
        name="day"
        label="Día de la sesión"
        defaultValue={day || null}
        placeholder="Elige un día"
        anios="futuro"
        onChange={onDay}
      />

      <fieldset>
        <legend className="field-label">Hora</legend>
        {!day ? (
          <p className="text-[12.5px] text-ink-3">Elige un día para ver sus huecos.</p>
        ) : (
          <div className="grid gap-2">
            {grupo("Mañana", MANANA)}
            {grupo("Tarde", TARDE)}
            <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
              Otra hora
              <input
                type="time"
                step={300}
                value={time}
                onChange={(e) => onTime(e.target.value)}
                className="field w-auto"
              />
            </label>
            <p aria-live="polite" className="text-[11.5px] text-ink-3">
              {cargando
                ? "Comprobando la ocupación de ese día…"
                : sinDatos
                  ? "No se pudo comprobar la ocupación. Al guardar se avisará de cualquier solape."
                  : "Tachadas, las horas que chocan con otra cita o un bloqueo."}
            </p>
          </div>
        )}
      </fieldset>

      {resumen && (
        <p className="rounded-md bg-surface-muted px-3 py-2 text-[13px] font-medium text-ink first-letter:uppercase">
          {resumen}
        </p>
      )}
      {choqueActual && (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>
            Se solapa con {choqueActual.label} ({formatTime(choqueActual.start)} –{" "}
            {formatTime(choqueActual.end)}). Al guardar se te pedirá confirmación.
          </span>
        </p>
      )}
    </div>
  );
}
