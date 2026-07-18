"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelAppointmentAction,
  deleteAppointmentAction,
  setAttendanceAction,
  updateAppointmentAction,
} from "@/lib/actions/appointments";
import { formatDateTime, toDatetimeLocal } from "@/lib/format";
import type { AgendaAppointment } from "@/lib/queries/appointments";

const STATUS: Record<string, string> = {
  scheduled: "programada",
  confirmed: "confirmada",
  cancelled: "cancelada",
  completed: "completada",
};

export function AppointmentItem({ appt }: { appt: AgendaAppointment }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(toDatetimeLocal(appt.starts_at));
  const [end, setEnd] = useState(toDatetimeLocal(appt.ends_at));
  const [videoLink, setVideoLink] = useState(appt.video_link ?? "");
  const [notes, setNotes] = useState(appt.notes ?? "");

  const cancelled = appt.status === "cancelled";

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <li className={`group p-4 ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {formatDateTime(appt.starts_at)}
            </span>
            <span className="text-xs text-ink-2">
              {appt.patientName ?? "—"}
            </span>
            <span className="chip">{STATUS[appt.status] ?? appt.status}</span>
          </div>
          {appt.video_link && (
            <a
              href={appt.video_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-medium text-accent hover:underline"
            >
              Videollamada
            </a>
          )}
          {appt.notes && <p className="mt-1 text-sm text-ink-2">{appt.notes}</p>}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
            Asistencia
            <select
              value={appt.attendance}
              disabled={pending}
              onChange={(e) =>
                run(() =>
                  setAttendanceAction(
                    appt.id,
                    e.target.value as "pending" | "attended" | "no_show" | "late_cancel",
                  ),
                )
              }
              className="field h-7 w-auto px-2 py-0.5 text-xs"
            >
              <option value="pending">Pendiente</option>
              <option value="attended">Acudió</option>
              <option value="no_show">No acudió</option>
              <option value="late_cancel">Canceló tarde</option>
            </select>
          </label>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
            <a href={`/appointments/${appt.id}/ics`} className="btn-subtle btn-sm">
              .ics
            </a>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="btn-subtle btn-sm"
            >
              Editar
            </button>
            {!cancelled && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => cancelAppointmentAction(appt.id))}
                className="btn-subtle btn-sm text-warn hover:text-warn"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteAppointmentAction(appt.id))}
              className="btn-danger btn-sm"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Inicio</span>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="field"
            />
          </label>
          <label className="block">
            <span className="field-label">Fin</span>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="field"
            />
          </label>
          <input
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            placeholder="Link de videollamada"
            className="field sm:col-span-2"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notas"
            className="field sm:col-span-2"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                await updateAppointmentAction({
                  id: appt.id,
                  patientId: appt.patient_id,
                  startsAt: new Date(start).toISOString(),
                  endsAt: new Date(end).toISOString(),
                  videoLink,
                  notes,
                });
                setEditing(false);
              })
            }
            className="btn-primary justify-self-start"
          >
            Guardar cambios
          </button>
        </div>
      )}
    </li>
  );
}
