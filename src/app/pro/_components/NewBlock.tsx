"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBlockAction } from "@/lib/actions/appointments";

const inputCls =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/[.16]";

export function NewBlock() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (!start || !end) {
      setError("Indica inicio y fin.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await createBlockAction({
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          reason,
        });
        setStart("");
        setEnd("");
        setReason("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al crear el bloqueo.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
      <h3 className="text-sm font-semibold">Nuevo bloqueo (vacaciones / no disponible)</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Inicio
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Fin
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputCls}
          />
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          className={`${inputCls} sm:col-span-2`}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="mt-3 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:hover:bg-white/[.06]"
      >
        {pending ? "Guardando…" : "Añadir bloqueo"}
      </button>
    </div>
  );
}
