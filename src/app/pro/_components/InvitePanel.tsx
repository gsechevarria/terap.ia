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
    <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
      <h3 className="text-sm font-semibold">Invitación</h3>
      {token ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="min-w-0 flex-1 rounded-lg border border-black/[.12] bg-black/[.03] px-2 py-1.5 text-xs dark:border-white/[.16] dark:bg-white/[.06]"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            Válida hasta {formatDate(expiresAt)}. Un solo uso.{" "}
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              className="underline disabled:opacity-60"
            >
              Regenerar
            </button>
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-xs text-neutral-500">
            Genera un enlace para que el paciente se dé de alta.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="mt-2 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:hover:bg-white/[.06]"
          >
            {pending ? "Generando…" : "Generar enlace de invitación"}
          </button>
        </div>
      )}
    </div>
  );
}
