"use client";
/*
 * Diálogo «Modificar cita». Vive aparte porque lo usan tres pantallas: la
 * agenda (desde el popup de la cita), «Todas las citas» y la pestaña Citas de
 * la ficha. Antes estaba dentro de `AgendaCalendar` y las otras dos solo
 * ofrecían el `.ics`, así que para cambiar una cita había que ir a buscarla al
 * calendario.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { callAction } from "@/lib/action-result";
import {
  cancelAppointmentAction,
  deleteAppointmentAction,
  setAttendanceAction,
  updateAppointmentAction,
} from "@/lib/actions/appointments";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/format";
import { actionErrorMessage } from "@/lib/errors";
import { FechaHoraSesion } from "@/app/pro/_components/FechaHoraSesion";
import {
  MENSAJE_ASISTENCIA_FUTURA,
  citaEmpezada,
  puedeRegistrarAsistencia,
} from "@/lib/asistencia";
import type { AgendaAppointment } from "@/lib/queries/appointments";

const DURATIONS = [30, 45, 60, 90] as const;

/** Botón que abre el diálogo. Para las pantallas que no son la agenda. */
export function BotonModificarCita({
  appt,
  className = "text-[12.5px] font-medium text-accent hover:underline",
}: {
  appt: AgendaAppointment;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={className}>
        Modificar
      </button>
      {abierto && (
        <EditarCitaDialog appt={appt} onClose={() => setAbierto(false)} />
      )}
    </>
  );
}

/* ----------------------------------------------------- modal de edición --- */

export function EditarCitaDialog({
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

  /*
   * ¿Ha empezado la cita con la fecha que hay ahora en el formulario? Si se
   * mueve al pasado en este mismo diálogo, se puede registrar la asistencia a
   * la vez. El servidor vuelve a comprobarlo con la hora guardada.
   * `Date.now()` en el render es aceptable aquí: el diálogo solo existe en el
   * cliente, tras un clic, así que no hay HTML de servidor con el que chocar.
   */
  const inicioFormulario = fromDatetimeLocal(`${day}T${time}`);
  const empezada = inicioFormulario
    ? citaEmpezada(inicioFormulario.toISOString())
    : citaEmpezada(appt.starts_at);

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
    if (
      attendance !== appt.attendance &&
      inicioFormulario &&
      !puedeRegistrarAsistencia(attendance, inicioFormulario.toISOString())
    ) {
      setError(MENSAJE_ASISTENCIA_FUTURA);
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
              {/* En una cita futura solo cabe «Pendiente». Si ya traía otro
                  valor (marcada antes de esta regla), se sigue viendo para que
                  se entienda el estado, pero no se puede volver a elegir. */}
              <option value="attended" disabled={!empezada && attendance !== "attended"}>
                Acudió
              </option>
              <option value="no_show" disabled={!empezada && attendance !== "no_show"}>
                No acudió
              </option>
              <option value="late_cancel" disabled={!empezada && attendance !== "late_cancel"}>
                Canceló tarde
              </option>
            </select>
            {!empezada && (
              <span className="mt-1 block text-[12.5px] text-ink-3">
                {attendance === "pending"
                  ? "Se registra cuando la cita haya empezado."
                  : "Esta cita aún no ha empezado: vuelve a ponerla en «Pendiente»."}
              </span>
            )}
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
