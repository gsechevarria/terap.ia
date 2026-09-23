"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, CalendarClock, CalendarX, Clock } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { resolveRequestAction } from "@/lib/actions/appointments";
import {
  formatDateTime,
  toDatetimeLocal,
  fromDatetimeLocal,
} from "@/lib/format";
import type { PendingRequest } from "@/lib/queries/appointment-requests";

/**
 * Los tres tipos de solicitud, con su icono.
 *
 * Ninguno lleva color propio, y la anulación menos que ninguno: una solicitud
 * es trabajo pendiente de decidir, no un riesgo. El rojo de esta aplicación
 * está reservado a lo clínico, así que lo que distingue un tipo de otro es el
 * icono y la palabra — que es además lo único que lee quien no ve el color.
 */
const KIND = {
  new: { label: "Cita nueva", Icon: CalendarPlus },
  reschedule: { label: "Cambio de hora", Icon: CalendarClock },
  cancel: { label: "Anulación", Icon: CalendarX },
};

/** Cómo se cerró una solicitud ya resuelta. El color acompaña al texto, no informa solo. */
const RESUELTA: Record<string, { texto: string; clase: string }> = {
  accepted: { texto: "Aceptada", clase: "text-success" },
  declined: { texto: "Rechazada", clase: "text-ink-3" },
};

export function RequestsPanel({
  pending,
  resolved,
}: {
  pending: PendingRequest[];
  resolved: PendingRequest[];
}) {
  if (pending.length === 0 && resolved.length === 0) {
    return (
      <div className="empty">
        <p className="text-[13.5px] text-ink">
          Aquí llegarán las peticiones de tus pacientes.
        </p>
        <p className="mt-1 text-[12.5px] text-ink-3">
          Desde su aplicación pueden pedir una cita nueva, proponer otro horario
          o anular una. Tú decides siempre.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <h2 className="section-title">
          Por decidir{" "}
          <span className="font-normal text-ink-4">
            {pending.length} {pending.length === 1 ? "solicitud" : "solicitudes"}
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="text-[13.5px] text-ink-3">
            No tienes solicitudes por decidir.
          </p>
        ) : (
          pending.map((r) => <RequestCard key={r.id} req={r} />)
        )}
      </section>

      {resolved.length > 0 && (
        <section className="border-t border-line pt-6">
          <details>
            <summary className="cursor-pointer text-[13.5px] text-ink-3 hover:text-ink">
              Resueltas ({resolved.length})
            </summary>
            <div className="table-wrap mt-3">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Solicitud</th>
                    <th>Horario pedido</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((r) => {
                    // Lo que no es aceptada ni rechazada lo retiró el propio
                    // paciente: no es una decisión del profesional.
                    const fin = RESUELTA[r.status] ?? {
                      texto: "Retirada",
                      clase: "text-ink-3",
                    };
                    return (
                      <tr key={r.id}>
                        <td className="font-medium">
                          {r.patientName ?? "Paciente"}
                        </td>
                        <td className="text-ink-2">{KIND[r.kind].label}</td>
                        <td className="text-ink-2">
                          {r.preferred_start ? (
                            formatDateTime(r.preferred_start)
                          ) : (
                            <span className="text-ink-3">Sin horario</span>
                          )}
                        </td>
                        <td>
                          <span className={`font-medium ${fin.clase}`}>
                            {fin.texto}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}

function RequestCard({ req }: { req: PendingRequest }) {
  const { label, Icon } = KIND[req.kind];
  const { run, pending, error } = useAction();
  // Sin abrir nada, aceptar usa el horario que pidió el paciente. El desplegable
  // solo aparece cuando el profesional quiere corregirlo o explicar un "no".
  const [mode, setMode] = useState<"idle" | "reschedule" | "decline">("idle");
  const [when, setWhen] = useState(
    req.preferred_start ? toDatetimeLocal(req.preferred_start) : "",
  );
  const [note, setNote] = useState("");

  function accept(startsAt?: string | null) {
    const ends =
      startsAt &&
      new Date(
        new Date(startsAt).getTime() + req.duration_min * 60_000,
      ).toISOString();
    run(() =>
      callAction(resolveRequestAction, {
        id: req.id,
        action: "accept",
        startsAt: startsAt ?? null,
        endsAt: ends ?? null,
      }),
    );
  }

  function acceptAsProposed() {
    accept(null);
  }

  function acceptWithNewTime() {
    const d = fromDatetimeLocal(when);
    if (!d) return;
    accept(d.toISOString());
  }

  function decline() {
    run(() =>
      callAction(resolveRequestAction, {
        id: req.id,
        action: "decline",
        note,
      }),
    );
  }

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
        <Link
          href={`/pro/patients/${req.patient_id}`}
          className="text-[13.5px] font-semibold hover:underline"
        >
          {req.patientName ?? "Paciente"}
        </Link>
        <span className="text-[13px] text-ink-2">{label}</span>
        <span className="ml-auto text-[12.5px] text-ink-3">
          pedida el {formatDateTime(req.created_at)}
        </span>
      </div>

      <dl className="mt-3 flex flex-col gap-1 text-[13.5px]">
        {req.kind !== "new" && req.appointmentStart && (
          <div className="flex gap-2">
            <dt className="text-ink-3">Cita actual:</dt>
            <dd className={req.kind === "cancel" ? "" : "line-through"}>
              {formatDateTime(req.appointmentStart)}
            </dd>
          </div>
        )}
        {req.preferred_start && (
          <div className="flex gap-2">
            <dt className="text-ink-3">
              {req.kind === "new" ? "Propone:" : "Prefiere:"}
            </dt>
            <dd className="font-medium">
              {formatDateTime(req.preferred_start)}
              <span className="ml-1 font-normal text-ink-3">
                , {req.duration_min} min
              </span>
            </dd>
          </div>
        )}
        {req.alt_start && (
          <div className="flex gap-2">
            <dt className="text-ink-3">Alternativa:</dt>
            <dd>{formatDateTime(req.alt_start)}</dd>
          </div>
        )}
      </dl>

      {req.note && (
        <p className="mt-2.5 rounded-lg bg-surface-muted px-3 py-2 text-[13.5px] whitespace-pre-wrap text-ink-2">
          “{req.note}”
        </p>
      )}

      {mode === "reschedule" && (
        <div className="mt-3.5 flex flex-col gap-2 border-t border-line pt-3.5">
          <label className="field-label" htmlFor={`when-${req.id}`}>
            Nuevo horario
          </label>
          <input
            id={`when-${req.id}`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="field"
          />
          <p className="text-[12.5px] text-ink-3">
            Se avisará al paciente del horario definitivo.
          </p>
        </div>
      )}

      {mode === "decline" && (
        <div className="mt-3.5 flex flex-col gap-2 border-t border-line pt-3.5">
          <label className="field-label" htmlFor={`note-${req.id}`}>
            Motivo (opcional, lo verá el paciente)
          </label>
          <textarea
            id={`note-${req.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="field"
            placeholder="Esa semana no tengo hueco; te propongo vernos la siguiente."
          />
        </div>
      )}

      {error && <p className="mt-3 text-[13.5px] text-danger">{error}</p>}

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {mode === "idle" && (
          <>
            <button
              type="button"
              onClick={acceptAsProposed}
              disabled={pending}
              className="btn-primary btn-sm"
            >
              {req.kind === "cancel" ? "Anular la cita" : "Aceptar"}
            </button>
            {req.kind !== "cancel" && (
              <button
                type="button"
                onClick={() => setMode("reschedule")}
                disabled={pending}
                className="btn-subtle btn-sm"
              >
                <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
                Proponer otra hora
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode("decline")}
              disabled={pending}
              className="btn-ghost btn-sm"
            >
              Rechazar
            </button>
          </>
        )}

        {mode === "reschedule" && (
          <>
            <button
              type="button"
              onClick={acceptWithNewTime}
              disabled={pending || !when}
              className="btn-primary btn-sm"
            >
              Confirmar este horario
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              disabled={pending}
              className="btn-ghost btn-sm"
            >
              Cancelar
            </button>
          </>
        )}

        {mode === "decline" && (
          <>
            <button
              type="button"
              onClick={decline}
              disabled={pending}
              className="btn-danger btn-sm"
            >
              Rechazar solicitud
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              disabled={pending}
              className="btn-ghost btn-sm"
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </article>
  );
}
