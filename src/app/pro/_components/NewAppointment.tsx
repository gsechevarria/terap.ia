"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAppointmentAction } from "@/lib/actions/appointments";

type Freq = "none" | "weekly" | "biweekly" | "monthly";

const inputCls =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/[.16]";

export function NewAppointment({
  patients,
  defaultPatientId,
}: {
  patients: { id: string; full_name: string | null }[];
  defaultPatientId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [freq, setFreq] = useState<Freq>("none");
  const [until, setUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function onStart(v: string) {
    setStart(v);
    if (v && (!end || new Date(end) <= new Date(v))) {
      const e = new Date(v);
      e.setMinutes(e.getMinutes() + 50);
      const pad = (n: number) => String(n).padStart(2, "0");
      setEnd(
        `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}T${pad(e.getHours())}:${pad(e.getMinutes())}`,
      );
    }
  }

  function submit() {
    const pid = patientId || patients[0]?.id;
    if (!pid) {
      setError("No hay pacientes activos.");
      return;
    }
    if (!start || !end) {
      setError("Indica inicio y fin.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await createAppointmentAction({
          patientId: pid,
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          videoLink,
          freq,
          until: until ? new Date(`${until}T23:59`).toISOString() : null,
          notes,
        });
        setStart("");
        setEnd("");
        setVideoLink("");
        setNotes("");
        setFreq("none");
        setUntil("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al crear la cita.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
      <h3 className="text-sm font-semibold">Nueva cita</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={patientId || patients[0]?.id || ""}
          onChange={(e) => setPatientId(e.target.value)}
          className={`${inputCls} sm:col-span-2`}
        >
          {patients.length === 0 && <option value="">Sin pacientes activos</option>}
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? "Sin nombre"}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Inicio
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => onStart(e.target.value)}
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
          value={videoLink}
          onChange={(e) => setVideoLink(e.target.value)}
          placeholder="Link de videollamada (Meet/Zoom)"
          className={`${inputCls} sm:col-span-2`}
        />
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          Repetición
          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value as Freq)}
            className={inputCls}
          >
            <option value="none">Puntual</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
          </select>
        </label>
        {freq !== "none" && (
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            Hasta
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className={inputCls}
            />
          </label>
        )}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas (opcional)"
          rows={2}
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
        className="mt-3 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Creando…" : "Crear cita"}
      </button>
    </div>
  );
}
