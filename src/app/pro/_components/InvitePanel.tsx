"use client";

import { useEffect, useRef, useState } from "react";
import { createInvitationAction } from "@/lib/actions/invitations";
import { formatDate } from "@/lib/format";
import { useAction } from "@/lib/use-action";

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
  const [copyError, setCopyError] = useState("");
  const { run, pending, error } = useAction({ refresh: false });
  const linkRef = useRef<HTMLInputElement>(null);

  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const link = token ? `${baseUrl}/invite/${token}` : "";
  const hasActive = Boolean(activeExpiresAt);

  function generate() {
    run(async () => {
      const res = await createInvitationAction(patientId);
      setToken(res.token);
      setExpiresAt(res.expiresAt);
      setCopied(false);
      setCopyError("");
    });
  }

  /**
   * El token se muestra UNA sola vez: si `writeText` falla (contexto no seguro,
   * permiso denegado, navegador embebido) y no se avisa, el profesional cree
   * que ha copiado el enlace y ya no hay forma de recuperarlo. Por eso hay
   * fallback a seleccionar el texto y un mensaje visible.
   */
  async function copy() {
    if (!link) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setCopyError(
        "No se ha podido copiar automáticamente. El enlace queda seleccionado: cópialo con Ctrl+C antes de salir de esta pantalla.",
      );
    }
  }

  return (
    <div className="card bg-panel p-4">
      <h3 className="section-label">Invitación</h3>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {token ? (
        // Enlace recién generado: se muestra una sola vez.
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={linkRef}
              readOnly
              value={link}
              aria-label="Enlace de invitación"
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
          {copyError && <p className="text-xs text-danger">{copyError}</p>}
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
