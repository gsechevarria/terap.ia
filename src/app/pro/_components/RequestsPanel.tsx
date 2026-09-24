"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, CalendarClock, CalendarX, Clock } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { resolveRequestAction } from "@/lib/actions/appointments";
import { formatDateTime, toDatetimeLocal, fromDatetimeLocal } from "@/lib/format";
import type { PendingRequest } from "@/lib/queries/appointment-requests";
import { FechaHoraSesion } from "@/app/pro/_components/FechaHoraSesion";

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

/** Cuántas resueltas se enseñan al lado; el resto no cabe ni hace falta. */
const RESUELTAS_VISIBLES = 12;

/**
 * Solicitudes con el lenguaje de «Hoy»: lo que hay que decidir a la izquierda,
 * como filas sobre la hoja separadas por su línea —no una tarjeta por
 * solicitud—, y lo ya resuelto a la derecha, a la vista, en una tabla sin caja.
 * Antes lo resuelto iba plegado en un desplegable al final.
 */
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

  const visibles = resolved.slice(0, RESUELTAS_VISIBLES);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <section className="min-w-0 flex-1" aria-labelledby="por-decidir">
        <h2 id="por-decidir" className="section-title mb-2.5">
          Por decidir{" "}
          <span className="font-normal text-ink-4">
            {pending.length} {pending.length === 1 ? "solicitud" : "solicitudes"}
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="border-t border-line py-3 text-[13.5px] text-ink-3">
            No tienes solicitudes por decidir.
          </p>
        ) : (
          <ul className="border-t border-line">
            {pending.map((r) => (
              <RequestRow key={r.id} req={r} />
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="w-full lg:w-[440px] lg:shrink-0" aria-labelledby="resueltas">
          <h2 id="resueltas" className="section-title mb-2.5">
            Resueltas{" "}
            <span className="font-normal text-ink-4">
              {resolved.length > RESUELTAS_VISIBLES
                ? `las ${RESUELTAS_VISIBLES} últimas`
                : resolved.length}
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="table-base table-plain">
              <thead>
                <tr>
                  <th scope="col">Paciente</th>
                  <th scope="col">Solicitud</th>
                  <th scope="col" className="text-right">
                    Resultado
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => {
                  // Lo que no es aceptada ni rechazada lo retiró el propio
                  // paciente: no es una decisión del profesional.
                  const fin = RESUELTA[r.status] ?? { texto: "Retirada", clase: "text-ink-3" };
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="font-medium">{r.patientName ?? "Paciente"}</span>
                        <span className="block text-[12.5px] text-ink-3">
                          {r.preferred_start ? formatDateTime(r.preferred_start) : "Sin horario"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-ink-2">{KIND[r.kind].label}</td>
                      <td className="text-right">
                        <span className={`font-medium ${fin.clase}`}>{fin.texto}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function RequestRow({ req }: { req: PendingRequest }) {
  const { label, Icon } = KIND[req.kind];
  const { run, pending, error } = useAction();
  // Sin abrir nada, aceptar usa el horario que pidió el paciente. El selector
  // solo aparece cuando el profesional quiere corregirlo o explicar un "no".
  const [mode, setMode] = useState<"idle" | "reschedule" | "decline">("idle");
  const inicial = req.preferred_start ? toDatetimeLocal(req.preferred_start) : "";
  const [day, setDay] = useState(inicial.slice(0, 10));
  const [time, setTime] = useState(inicial.slice(11, 16));
  const [note, setNote] = useState("");

  function accept(startsAt?: string | null) {
    const ends =
      startsAt &&
      new Date(new Date(startsAt).getTime() + req.duration_min * 60_000).toISOString();
    run(() =>
      callAction(resolveRequestAction, {
        id: req.id,
        action: "accept",
        startsAt: startsAt ?? null,
        endsAt: ends ?? null,
      }),
    );
  }

  function acceptWithNewTime() {
    const d = fromDatetimeLocal(`${day}T${time}`);
    if (!d) return;
    accept(d.toISOString());
  }

  function decline() {
    run(() => callAction(resolveRequestAction, { id: req.id, action: "decline", note }));
  }

  return (
    <li className="py-4" style={{ borderBottom: "1px solid var(--line-soft)" }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Icon className="size-4 shrink-0 self-center text-ink-3" strokeWidth={1.75} aria-hidden />
        <Link
          href={`/pro/patients/${req.patient_id}`}
          className="text-[14px] font-semibold hover:text-accent"
        >
          {req.patientName ?? "Paciente"}
        </Link>
        <span className="text-[13px] text-ink-2">{label}</span>
        <span className="ml-auto text-[12.5px] text-ink-3">
          pedida el {formatDateTime(req.created_at)}
        </span>
      </div>

      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 pl-7 text-[13.5px]">
        {req.kind !== "new" && req.appointmentStart && (
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Cita actual</dt>
            <dd className={req.kind === "cancel" ? "" : "text-ink-3 line-through"}>
              {formatDateTime(req.appointmentStart)}
            </dd>
          </div>
        )}
        {req.preferred_start && (
          <div className="flex gap-1.5">
            <dt className="text-ink-3">{req.kind === "new" ? "Propone" : "Prefiere"}</dt>
            <dd className="font-semibold">
              {formatDateTime(req.preferred_start)}
              <span className="ml-1 font-normal text-ink-3">, {req.duration_min} min</span>
            </dd>
          </div>
        )}
        {req.alt_start && (
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Alternativa</dt>
            <dd>{formatDateTime(req.alt_start)}</dd>
          </div>
        )}
      </dl>

      {req.note && (
        <p className="mt-2.5 ml-7 rounded-md bg-surface-muted px-3 py-2 text-[13.5px] whitespace-pre-wrap text-ink-2">
          “{req.note}”
        </p>
      )}

      {mode === "reschedule" && (
        <div className="mt-3.5 ml-7 max-w-md border-t border-line-soft pt-3.5">
          <FechaHoraSesion
            day={day}
            time={time}
            minutes={req.duration_min}
            excludeId={req.appointment_id ?? undefined}
            onDay={setDay}
            onTime={setTime}
          />
          <p className="mt-2 text-[12.5px] text-ink-3">
            Se avisará al paciente del horario definitivo.
          </p>
        </div>
      )}

      {mode === "decline" && (
        <div className="mt-3.5 ml-7 flex max-w-md flex-col gap-2 border-t border-line-soft pt-3.5">
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

      {error && <p className="mt-3 ml-7 text-[13.5px] text-danger">{error}</p>}

      <div className="mt-3 ml-7 flex flex-wrap items-center gap-2">
        {mode === "idle" && (
          <>
            <button
              type="button"
              onClick={() => accept(null)}
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
                className="btn-ghost btn-sm"
              >
                <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
                Proponer otra hora
              </button>
            )}
            <button
              type="button"
              onClick={() => setMode("decline")}
              disabled={pending}
              className="btn-subtle btn-sm"
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
              disabled={pending || !day || !time}
              className="btn-primary btn-sm"
            >
              Confirmar este horario
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              disabled={pending}
              className="btn-subtle btn-sm"
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
              className="btn-subtle btn-sm"
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </li>
  );
}
