"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondAppointmentAction } from "@/lib/actions/appointments";
import { formatDateTime } from "@/lib/format";
import { Status, type StatusTone } from "@/components/ui/Status";
import type { Appointment } from "@/lib/types";

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  scheduled: { label: "por confirmar", tone: "info" },
  confirmed: { label: "confirmada", tone: "accent" },
  cancelled: { label: "cancelada", tone: "neutral" },
  completed: { label: "realizada", tone: "neutral" },
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
    <li className={`card p-4 ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {formatDateTime(appt.starts_at)}
        </span>
        <Status tone={(STATUS[appt.status] ?? { tone: "neutral" as const }).tone}>
          {(STATUS[appt.status] ?? { label: appt.status }).label}
        </Status>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
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
              className="btn-primary"
            >
              Confirmar
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => respond("cancel")}
            className="btn-ghost"
          >
            Cancelar
          </button>
        </div>
      )}
    </li>
  );
}
