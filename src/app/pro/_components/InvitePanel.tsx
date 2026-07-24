"use client";

import { useState, useTransition } from "react";
import { createInvitationAction } from "@/lib/actions/invitations";
import { formatDate } from "@/lib/format";

export function InvitePanel({
  patientId,
  baseUrl,
  activeExpiresAt,
}: {
  patientId: string;
  baseUrl: string;
  /** Caducidad de la invitación activa (si la hay). El enlace NO se persiste:
   *  solo se muestra el que se genere en esta sesión. */
  activeExpiresAt?: string | null;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(
    activeExpiresAt ?? null,
  );
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const link = token ? `${baseUrl}/invite/${token}` : "";
  const hasActive = Boolean(activeExpiresAt);

  function generate() {
    startTransition(async () => {
      const res = await createInvitationAction(patientId);
      setToken(res.token);
      setExpiresAt(res.expiresAt);
      setCopied(false);
    });
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card bg-panel p-4">
      <h3 className="section-label">Invitación</h3>

      {token ? (
        // Enlace recién generado: se muestra una sola vez.
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="field min-w-0 flex-1 px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={copy}
              className="btn-primary h-7 shrink-0 px-2.5 text-xs"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-xs text-ink-3">
            Válida hasta {formatDate(expiresAt)}. Un solo uso.{" "}
            <strong className="font-medium text-ink-2">
              Cópialo ahora
            </strong>
            : por seguridad no se vuelve a mostrar.
          </p>
        </div>
      ) : hasActive ? (
        // Hay una invitación activa pero su enlace no está en memoria.
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-ink-2">
            Hay una invitación activa (válida hasta {formatDate(expiresAt)}). El
            enlace solo se muestra al crearlo; si lo perdiste, genera uno nuevo
            (invalida el anterior al aceptarse cualquiera).
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="btn-ghost self-start"
          >
            {pending ? "Generando…" : "Generar enlace nuevo"}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-ink-2">
            Genera un enlace para que el paciente se dé de alta.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="btn-ghost mt-3"
          >
            {pending ? "Generando…" : "Generar enlace de invitación"}
          </button>
        </div>
      )}
    </div>
  );
}
