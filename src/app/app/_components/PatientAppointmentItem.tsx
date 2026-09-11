"use client";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { callAction } from "@/lib/action-result";

import {
  respondAppointmentAction,
  withdrawRequestAction,
} from "@/lib/actions/appointments";
import { formatDateTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { safeExternalUrl } from "@/lib/url";
import { Status, type StatusTone } from "@/components/ui/Status";
import type { Appointment } from "@/lib/types";
import type { AppointmentRequest } from "@/lib/queries/appointment-requests";

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  scheduled: { label: "por confirmar", tone: "info" },
  confirmed: { label: "confirmada", tone: "accent" },
  cancelled: { label: "cancelada", tone: "neutral" },
  completed: { label: "realizada", tone: "neutral" },
};

export function PatientAppointmentItem({
  appt,
  canRespond,
  request = null,
}: {
  appt: Appointment;
  canRespond: boolean;
  /** Solicitud viva sobre esta cita, si el paciente ya pidió moverla. */
  request?: AppointmentRequest | null;
}) {
  const { run, pending, error } = useAction();
  const cancelled = appt.status === "cancelled";

  function respond(action: "confirm" | "cancel") {
    run(() => callAction(respondAppointmentAction, appt.id, action));
  }

  function withdraw() {
    if (request) run(() => callAction(withdrawRequestAction, request.id));
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
        {/* Defensa en profundidad: el esquema se valida también al guardar. */}
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
          Añadir al calendario (.ics)
        </a>
      </div>
      {request && !cancelled && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-warn-soft px-3 py-2 text-sm">
          <CalendarClock className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>
            Has pedido cambiarla
            {request.preferred_start
              ? ` al ${formatDateTime(request.preferred_start)}`
              : ""}
            . Pendiente de respuesta.
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={withdraw}
            className="ml-auto underline underline-offset-2 hover:no-underline"
          >
            Retirar
          </button>
        </div>
      )}

      {canRespond && !cancelled && (
        <div className="mt-3 flex flex-wrap gap-2">
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
          {!request && (
            <Link
              href={`/app/appointments/new?cambiar=${appt.id}`}
              className="btn-subtle"
            >
              Pedir otro día
            </Link>
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
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </li>
  );
}
