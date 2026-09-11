"use client";
import { useRef, useState, useTransition } from "react";
import { callAction, type ActionResult } from "@/lib/action-result";
import { actionErrorMessage } from "@/lib/errors";
/** Evita el reseteo automático de React cuando la operación devuelve un error. */
export function ActionForm({ action, children, className }: {
  action: (data: FormData) => Promise<ActionResult<void>>;
  children: React.ReactNode; className?: string;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const sending = useRef(false);
  return <form className={className} aria-busy={pending} onSubmit={event => {
    event.preventDefault();
    if (sending.current) return;
    const data = new FormData(event.currentTarget);
    sending.current = true;
    setError("");
    startTransition(async () => {
      try { await callAction(action, data); }
      catch (e) { setError(actionErrorMessage(e)); }
      finally { sending.current = false; }
    });
  }}>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <fieldset disabled={pending} className="contents">{children}</fieldset>
  </form>;
}
