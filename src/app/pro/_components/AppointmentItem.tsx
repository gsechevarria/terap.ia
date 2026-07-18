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

const inputCls =
  "rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm outline-none dark:border-white/[.16]";

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
    <li
      className={`rounded-lg border border-black/[.08] p-3 dark:border-white/[.12] ${
        cancelled ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{formatDateTime(appt.starts_at)}</span>
            <span className="text-xs text-neutral-500">
              {appt.patientName ?? "—"}
            </span>
            <span className="rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-neutral-600 dark:bg-white/[.08] dark:text-neutral-300">
              {STATUS[appt.status] ?? appt.status}
            </span>
          </div>
          {appt.video_link && (
            <a
              href={appt.video_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-sky-600 underline"
            >
              Videollamada
            </a>
          )}
          {appt.notes && (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {appt.notes}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 text-xs">
          <label className="flex items-center gap-1 text-neutral-500">
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
              className={inputCls}
            >
              <option value="pending">Pendiente</option>
              <option value="attended">Acudió</option>
              <option value="no_show">No acudió</option>
              <option value="late_cancel">Canceló tarde</option>
            </select>
          </label>
          <div className="flex items-center gap-2">
            <a
              href={`/appointments/${appt.id}/ics`}
              className="text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              .ics
            </a>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-neutral-500 underline"
            >
              editar
            </button>
            {!cancelled && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => cancelAppointmentAction(appt.id))}
                className="text-amber-600 underline disabled:opacity-60"
              >
                cancelar
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteAppointmentAction(appt.id))}
              className="text-red-600 underline disabled:opacity-60"
            >
              eliminar
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid gap-2 border-t border-black/[.06] pt-3 sm:grid-cols-2 dark:border-white/[.1]">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Inicio
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Fin
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={inputCls}
            />
          </label>
          <input
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            placeholder="Link de videollamada"
            className={`${inputCls} sm:col-span-2`}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notas"
            className={`${inputCls} sm:col-span-2`}
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
            className="justify-self-start rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            Guardar cambios
          </button>
        </div>
      )}
    </li>
  );
}
