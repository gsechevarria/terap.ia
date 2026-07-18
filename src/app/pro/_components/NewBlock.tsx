"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBlockAction } from "@/lib/actions/appointments";

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
    <div className="card bg-panel p-4">
      <h3 className="section-label">Nuevo bloqueo (vacaciones / no disponible)</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Inicio</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="field"
          />
        </label>
        <label className="block">
          <span className="field-label">Fin</span>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="field"
          />
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          className="field sm:col-span-2"
        />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="btn-ghost mt-3"
      >
        {pending ? "Guardando…" : "Añadir bloqueo"}
      </button>
    </div>
  );
}
