"use client";

import { useState, useTransition } from "react";
import { createInvitationAction } from "@/lib/actions/invitations";
import { formatDate } from "@/lib/format";

export function InvitePanel({
  patientId,
  baseUrl,
  initialToken,
  initialExpiresAt,
}: {
  patientId: string;
  baseUrl: string;
  initialToken?: string | null;
  initialExpiresAt?: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(
    initialExpiresAt ?? null,
  );
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const link = token ? `${baseUrl}/invite/${token}` : "";

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
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              className="underline underline-offset-2 hover:text-ink disabled:opacity-50"
            >
              Regenerar
            </button>
          </p>
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
