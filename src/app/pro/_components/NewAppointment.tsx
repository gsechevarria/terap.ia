"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAppointmentAction } from "@/lib/actions/appointments";

type Freq = "none" | "weekly" | "biweekly" | "monthly";

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
    <div className="card bg-panel p-4">
      <h3 className="section-label">Nueva cita</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={patientId || patients[0]?.id || ""}
          onChange={(e) => setPatientId(e.target.value)}
          className="field sm:col-span-2"
        >
          {patients.length === 0 && <option value="">Sin pacientes activos</option>}
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? "Sin nombre"}
            </option>
          ))}
        </select>
        <label className="block">
          <span className="field-label">Inicio</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => onStart(e.target.value)}
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
          value={videoLink}
          onChange={(e) => setVideoLink(e.target.value)}
          placeholder="Link de videollamada (Meet/Zoom)"
          className="field sm:col-span-2"
        />
        <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
          Repetición
          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value as Freq)}
            className="field w-auto"
          >
            <option value="none">Puntual</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
          </select>
        </label>
        {freq !== "none" && (
          <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
            Hasta
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="field w-auto"
            />
          </label>
        )}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas (opcional)"
          rows={2}
          className="field sm:col-span-2"
        />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="btn-primary mt-3"
      >
        {pending ? "Creando…" : "Crear cita"}
      </button>
    </div>
  );
}
