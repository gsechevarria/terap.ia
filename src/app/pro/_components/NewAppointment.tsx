"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { createAppointmentAction } from "@/lib/actions/appointments";

type Freq = "none" | "weekly" | "biweekly" | "monthly";

const DURATIONS = [30, 45, 60, 90] as const;

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
  const [duration, setDuration] = useState<number>(60);
  const [customMode, setCustomMode] = useState(false);
  const [customMin, setCustomMin] = useState("60");
  const [videoLink, setVideoLink] = useState("");
  const [freq, setFreq] = useState<Freq>("none");
  const [until, setUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");

  const minutes = customMode ? Math.max(5, parseInt(customMin, 10) || 0) : duration;

  // Al tocar cualquier campo relevante, el aviso de conflicto deja de ser válido.
  function clearConflict() {
    if (conflict) setConflict("");
  }

  function submit(force = false) {
    const pid = patientId || patients[0]?.id;
    if (!pid) {
      setError("No hay pacientes activos.");
      return;
    }
    if (!start) {
      setError("Indica la fecha y hora de la sesión.");
      return;
    }
    if (!minutes || minutes < 5) {
      setError("La duración debe ser de al menos 5 minutos.");
      return;
    }
    setError("");
    const startDate = new Date(start);
    const endsAt = new Date(startDate.getTime() + minutes * 60_000).toISOString();

    startTransition(async () => {
      try {
        const res = await createAppointmentAction({
          patientId: pid,
          startsAt: startDate.toISOString(),
          endsAt,
          videoLink,
          freq,
          until: until ? new Date(`${until}T23:59`).toISOString() : null,
          notes,
          force,
        });
        if (!res.ok) {
          setConflict(res.conflict);
          return;
        }
        setStart("");
        setDuration(60);
        setCustomMode(false);
        setCustomMin("60");
        setVideoLink("");
        setNotes("");
        setFreq("none");
        setUntil("");
        setConflict("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al crear la cita.");
      }
    });
  }

  return (
    <div className="card bg-panel p-4">
      <h3 className="section-label">Nueva cita</h3>
      <div className="mt-3 grid gap-2.5">
        <select
          value={patientId || patients[0]?.id || ""}
          onChange={(e) => setPatientId(e.target.value)}
          className="field"
        >
          {patients.length === 0 && <option value="">Sin pacientes activos</option>}
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? "Sin nombre"}
            </option>
          ))}
        </select>

        <label className="block">
          <span className="field-label">Fecha y hora de la sesión</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              clearConflict();
            }}
            className="field"
          />
        </label>

        <div>
          <span className="field-label">Duración</span>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((d) => {
              const active = !customMode && duration === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    setDuration(d);
                    clearConflict();
                  }}
                  className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line-strong bg-canvas text-ink-2 hover:bg-wash hover:text-ink"
                  }`}
                >
                  {d} min
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setCustomMode(true);
                clearConflict();
              }}
              className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors duration-150 ${
                customMode
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line-strong bg-canvas text-ink-2 hover:bg-wash hover:text-ink"
              }`}
            >
              Personalizado
            </button>
          </div>
          {customMode && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={5}
                step={5}
                value={customMin}
                onChange={(e) => {
                  setCustomMin(e.target.value);
                  clearConflict();
                }}
                className="field w-24"
                aria-label="Duración personalizada en minutos"
              />
              <span className="text-sm text-ink-2">minutos</span>
            </div>
          )}
        </div>

        <input
          value={videoLink}
          onChange={(e) => setVideoLink(e.target.value)}
          placeholder="Link de videollamada (Meet/Zoom)"
          className="field"
        />
        <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
          Repetición
          <select
            value={freq}
            onChange={(e) => {
              setFreq(e.target.value as Freq);
              clearConflict();
            }}
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
              onChange={(e) => {
                setUntil(e.target.value);
                clearConflict();
              }}
              className="field w-auto"
            />
          </label>
        )}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas (opcional)"
          rows={2}
          className="field"
        />
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {conflict ? (
        <div className="mt-3 rounded-md border border-warn/30 bg-warn-soft p-3">
          <div className="flex items-start gap-2 text-sm text-warn">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
            <p>{conflict}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={pending}
              className="btn-primary btn-sm"
            >
              {pending ? "Creando…" : "Crear de todos modos"}
            </button>
            <button
              type="button"
              onClick={() => setConflict("")}
              className="btn-subtle btn-sm"
            >
              Revisar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={pending}
          className="btn-primary mt-3"
        >
          {pending ? "Creando…" : "Crear cita"}
        </button>
      )}
    </div>
  );
}
