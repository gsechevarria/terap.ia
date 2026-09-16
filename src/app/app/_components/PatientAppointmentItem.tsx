"use client";

import Link from "next/link";
import { CalendarPlus, Check, Heart, Video } from "lucide-react";
import { callAction } from "@/lib/action-result";
import {
  respondAppointmentAction,
  withdrawRequestAction,
} from "@/lib/actions/appointments";
import { useAction } from "@/lib/use-action";
import { safeExternalUrl } from "@/lib/url";
import type { Appointment } from "@/lib/types";
import type { AppointmentRequest } from "@/lib/queries/appointment-requests";

/** Etiqueta del estado real de la cita. No se deduce nada que no venga de la BD. */
const ESTADO: Record<string, string> = {
  scheduled: "Por confirmar",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
};

/**
 * Tarjeta de una cita próxima: la fecha es la protagonista, confirmar es la
 * única acción rellena, y reprogramar y cancelar quedan como secundarias.
 *
 * Las fechas llegan ya formateadas desde el servidor (`diaGrande`, `diaSemana`,
 * `hora`, `mes`). Formatearlas aquí las resolvería en la zona del navegador en
 * cliente y en UTC en servidor: dos horas distintas para la misma cita.
 */
export function PatientAppointmentItem({
  appt,
  canRespond,
  request = null,
  diaGrande,
  diaSemana,
  hora,
  mes,
  cambioPedidoA,
}: {
  appt: Appointment;
  canRespond: boolean;
  /** Solicitud viva sobre esta cita, si el paciente ya pidió moverla. */
  request?: AppointmentRequest | null;
  diaGrande: string;
  diaSemana: string;
  hora: string;
  mes: string;
  /** Horario preferido de esa solicitud, ya formateado. */
  cambioPedidoA?: string | null;
}) {
  const { run, pending, error } = useAction();
  const cancelada = appt.status === "cancelled";
  const video = safeExternalUrl(appt.video_link);

  function responder(accion: "confirm" | "cancel") {
    run(() => callAction(respondAppointmentAction, appt.id, accion));
  }

  function retirar() {
    if (request) run(() => callAction(withdrawRequestAction, request.id));
  }

  return (
    <article className="tp-appointment" style={cancelada ? { opacity: 0.65 } : undefined}>
      <div className="tp-appointment-top">
        <span className="tp-month-pill">{mes}</span>
        <span className={`tp-status${cancelada ? " tp-status-muted" : ""}`}>
          {ESTADO[appt.status] ?? appt.status}
        </span>
      </div>

      <div className="tp-appointment-hero">
        <strong>{diaGrande}</strong>
        <div>
          <h2>{diaSemana}</h2>
          <p>{hora}</p>
        </div>
      </div>

      <div className="tp-professional-line">
        <span className="tp-professional-icon">
          <Heart size={19} strokeWidth={1.6} aria-hidden />
        </span>
        <div>
          <strong>Sesión con tu profesional</strong>
          <span>
            {video ? "Con enlace de videollamada" : "Tu próximo encuentro"}
          </span>
        </div>
      </div>

      {/* La solicitud de cambio se muestra FUERA de la acción principal: es
          otra cosa que está pasando con esta cita, no un botón más. */}
      {request && !cancelada && (
        <p className="tp-inline-note">
          <span>
            Has pedido cambiarla{cambioPedidoA ? ` al ${cambioPedidoA}` : ""}.
            Pendiente de respuesta.
          </span>
          <button type="button" onClick={retirar} disabled={pending}>
            Retirar
          </button>
        </p>
      )}

      {error && <p className="tp-inline-error">{error}</p>}

      {canRespond && !cancelada && (
        <>
          {video && (
            <a
              className="tp-secondary tp-wide"
              href={video}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginBottom: 10 }}
            >
              <Video size={17} strokeWidth={1.7} aria-hidden />
              Entrar a la videollamada
            </a>
          )}

          {appt.status !== "confirmed" ? (
            <button
              type="button"
              className="tp-primary tp-wide"
              onClick={() => responder("confirm")}
              disabled={pending}
            >
              {pending ? "Enviando…" : "Confirmar asistencia"}
              {!pending && <Check size={19} strokeWidth={2} aria-hidden />}
            </button>
          ) : (
            <p className="tp-section-desc" style={{ marginTop: 0 }}>
              Ya has confirmado que asistirás.
            </p>
          )}

          <div className="tp-appointment-secondary">
            {!request ? (
              <Link
                href={`/app/appointments/new?cambiar=${appt.id}`}
                className="tp-text-action"
              >
                Pedir otro día
              </Link>
            ) : (
              <span className="tp-text-action">Cambio pedido</span>
            )}
            <button
              type="button"
              className="tp-text-action tp-danger-text"
              onClick={() => responder("cancel")}
              disabled={pending}
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      <a className="tp-appointment-foot" href={`/appointments/${appt.id}/ics`}>
        <CalendarPlus size={16} strokeWidth={1.7} aria-hidden />
        Añadir a mi calendario
      </a>
    </article>
  );
}
