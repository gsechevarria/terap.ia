"use client";
import { callAction } from "@/lib/action-result";

import { useEffect, useRef, useState } from "react";
import { MailCheck, MailWarning, ShieldCheck, Clock, Ban } from "lucide-react";
import {
  createInvitationAction,
  revokeInvitationAction,
  type ResultadoInvitacion,
} from "@/lib/actions/invitations";
import { formatDateTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { Status, type StatusTone } from "@/components/ui/Status";
import type { AccesoPaciente, EstadoAcceso } from "@/lib/queries/invitations";

const ETIQUETA: Record<EstadoAcceso, { texto: string; tono: StatusTone }> = {
  sin_invitar: { texto: "Sin invitar", tono: "neutral" },
  pendiente: { texto: "Invitación pendiente", tono: "info" },
  caducada: { texto: "Invitación caducada", tono: "warn" },
  revocada: { texto: "Invitación revocada", tono: "neutral" },
  vinculado: { texto: "Acceso vinculado", tono: "success" },
};

/**
 * "Invitar a Terap" desde la ficha del paciente.
 *
 * El expediente existe sin que el paciente tenga cuenta, y eso se conserva: la
 * invitación es opcional y no cambia nada del expediente. Aceptarla VINCULA la
 * cuenta a ESTE expediente; no crea otro ni sobrescribe un vínculo ajeno.
 */
export function InvitePanel({
  patientId,
  acceso,
  emailFicha,
}: {
  patientId: string;
  acceso: AccesoPaciente;
  /** Correo que hay en la ficha, como valor por defecto del destinatario. */
  emailFicha: string | null;
}) {
  const [email, setEmail] = useState(acceso.email ?? emailFicha ?? "");
  const [resultado, setResultado] = useState<ResultadoInvitacion | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [errorCopia, setErrorCopia] = useState("");
  const { run, pending, error } = useAction();
  const enlaceRef = useRef<HTMLInputElement>(null);

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  const etiqueta = ETIQUETA[acceso.estado];
  const vinculado = acceso.estado === "vinculado";

  function invitar() {
    run(async () => {
      const res = await callAction(createInvitationAction, patientId, email.trim());
      setResultado(res);
      setCopiado(false);
      setErrorCopia("");
    });
  }

  function revocar() {
    if (!acceso.invitationId) return;
    run(() => callAction(revokeInvitationAction, acceso.invitationId!, patientId));
  }

  /**
   * El enlace se enseña UNA vez. Si `writeText` falla (contexto no seguro,
   * permiso denegado, navegador embebido) y no se avisa, quien invita cree que
   * lo ha copiado y ya no hay forma de recuperarlo.
   */
  async function copiar() {
    if (!resultado) return;
    setErrorCopia("");
    try {
      await navigator.clipboard.writeText(resultado.url);
      setCopiado(true);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      enlaceRef.current?.focus();
      enlaceRef.current?.select();
      setErrorCopia(
        "No se ha podido copiar automáticamente. El enlace queda seleccionado: cópialo con Ctrl+C antes de salir de esta pantalla.",
      );
    }
  }

  return (
    <div className="card bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-label">Acceso a Terap</h3>
        <Status tone={etiqueta.tono}>{etiqueta.texto}</Status>
      </div>

      {(acceso.email || acceso.enviadaEl) && (
        <dl className="mt-3 flex flex-col gap-1 text-xs text-ink-2">
          {acceso.email && (
            <div className="flex gap-1.5">
              <dt className="text-ink-3">Destinatario:</dt>
              <dd className="min-w-0 truncate">{acceso.email}</dd>
            </div>
          )}
          {acceso.enviadaEl && (
            <div className="flex gap-1.5">
              <dt className="text-ink-3">Enviada:</dt>
              <dd>{formatDateTime(acceso.enviadaEl)}</dd>
            </div>
          )}
          {acceso.caducaEl && !vinculado && (
            <div className="flex gap-1.5">
              <dt className="text-ink-3">Caduca:</dt>
              <dd>{formatDateTime(acceso.caducaEl)}</dd>
            </div>
          )}
        </dl>
      )}

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      {vinculado ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-ink-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2} aria-hidden />
          El paciente ya tiene acceso a su espacio. El expediente sigue siendo
          tuyo; él solo ve lo suyo.
        </p>
      ) : resultado ? (
        // Enlace recién emitido. Se muestra una sola vez.
        <div className="mt-3 flex flex-col gap-2">
          <p className="flex items-start gap-2 text-xs">
            {resultado.correo === "sent" ? (
              <>
                <MailCheck className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2} aria-hidden />
                <span className="text-ink-2">
                  El proveedor ha aceptado el correo para{" "}
                  <strong className="font-medium text-ink">{resultado.destinatario}</strong>.
                  Eso no es acuse de lectura: si no le llega, usa el enlace.
                </span>
              </>
            ) : (
              <>
                <MailWarning className="mt-0.5 size-3.5 shrink-0 text-warn" strokeWidth={2} aria-hidden />
                <span className="text-ink-2">
                  {resultado.correo === "no_provider"
                    ? "No hay proveedor de correo configurado en este entorno, así que no se ha enviado nada."
                    : "El correo no ha podido enviarse."}{" "}
                  La invitación SÍ está creada: entrégale este enlace por otra vía.
                </span>
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={enlaceRef}
              readOnly
              value={resultado.url}
              aria-label="Enlace de invitación"
              className="field min-w-0 flex-1 px-2 py-1.5 text-xs"
            />
            <button type="button" onClick={copiar} className="btn-primary h-7 shrink-0 px-2.5 text-xs">
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-xs text-ink-3">
            Válido hasta {formatDateTime(resultado.expiresAt)}. Un solo uso.{" "}
            <strong className="font-medium text-ink-2">Cópialo ahora</strong>: por
            seguridad no se vuelve a mostrar.
          </p>
          {errorCopia && <p className="text-xs text-danger">{errorCopia}</p>}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <label className="field-label" htmlFor="invitar-email">
            Correo del paciente
          </label>
          <input
            id="invitar-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@correo.com"
            className="field text-sm"
          />
          <p className="text-xs text-ink-3">
            Solo esa dirección podrá aceptar la invitación. Reenviar invalida el
            enlace anterior.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={invitar}
              disabled={pending || !email.trim()}
              className="btn-primary"
            >
              {pending
                ? "Enviando…"
                : acceso.estado === "sin_invitar"
                  ? "Invitar a Terap"
                  : "Reenviar invitación"}
            </button>
            {acceso.estado === "pendiente" && acceso.invitationId && (
              <button type="button" onClick={revocar} disabled={pending} className="btn-danger">
                <Ban className="size-3.5" strokeWidth={2} aria-hidden />
                Revocar
              </button>
            )}
          </div>
          {acceso.estado === "caducada" && (
            <p className="flex items-start gap-1.5 text-xs text-ink-2">
              <Clock className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              El enlace anterior caducó sin usarse. Puedes enviar otro.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
