"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondAppointmentAction } from "@/lib/actions/appointments";
import { formatDateTime } from "@/lib/format";
import type { Appointment } from "@/lib/types";

const STATUS: Record<string, string> = {
  scheduled: "por confirmar",
  confirmed: "confirmada",
  cancelled: "cancelada",
  completed: "realizada",
};

export function PatientAppointmentItem({
  appt,
  canRespond,
}: {
  appt: Appointment;
  canRespond: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cancelled = appt.status === "cancelled";

  function respond(action: "confirm" | "cancel") {
    startTransition(async () => {
      await respondAppointmentAction(appt.id, action);
      router.refresh();
    });
  }

  return (
    <li
      className={`rounded-xl border border-black/[.08] p-4 dark:border-white/[.12] ${
        cancelled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{formatDateTime(appt.starts_at)}</span>
        <span className="rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-neutral-600 dark:bg-white/[.08] dark:text-neutral-300">
          {STATUS[appt.status] ?? appt.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        {appt.video_link && (
          <a
            href={appt.video_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 underline"
          >
            Videollamada
          </a>
        )}
        <a
          href={`/appointments/${appt.id}/ics`}
          className="text-neutral-500 underline"
        >
          Añadir al calendario (.ics)
        </a>
      </div>
      {canRespond && !cancelled && (
        <div className="mt-3 flex gap-2">
          {appt.status !== "confirmed" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("confirm")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Confirmar
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => respond("cancel")}
            className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium disabled:opacity-60 dark:border-white/[.16]"
          >
            Cancelar
          </button>
        </div>
      )}
    </li>
  );
}
