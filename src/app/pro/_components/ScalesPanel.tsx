"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createScaleAssignmentAction,
  setScaleAssignmentActiveAction,
} from "@/lib/actions/scales";
import { formatDate } from "@/lib/format";
import type { CatalogScale } from "@/lib/queries/scales";
import type { ScaleAssignmentView } from "@/lib/queries/patient-detail";

export function ScalesPanel({
  patientId,
  catalog,
  assignments,
}: {
  patientId: string;
  catalog: CatalogScale[];
  assignments: ScaleAssignmentView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const activeCodes = new Set(
    assignments.filter((a) => a.active).map((a) => a.scaleCode),
  );
  const available = catalog.filter((c) => !activeCodes.has(c.code));

  const [scaleId, setScaleId] = useState("");
  const [type, setType] = useState<"one_off" | "recurring">("one_off");
  const [interval, setInterval] = useState(14);

  function activate() {
    const chosen = scaleId || available[0]?.id;
    if (!chosen) return;
    startTransition(async () => {
      await createScaleAssignmentAction({
        patientId,
        scaleId: chosen,
        type,
        intervalDays: type === "recurring" ? interval : null,
      });
      setScaleId("");
      router.refresh();
    });
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      await setScaleAssignmentActiveAction(id, patientId, active);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card bg-panel p-4">
        <h3 className="section-label">Activar una escala (opt-in)</h3>
        <p className="mt-1 text-xs text-ink-3">
          Sin activación, el paciente no ve ningún cuestionario.
        </p>
        {available.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">
            Todas las escalas del catálogo ya están activas para este paciente.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <select
              value={scaleId || available[0]?.id}
              onChange={(e) => setScaleId(e.target.value)}
              className="field"
            >
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="scale-type"
                  checked={type === "one_off"}
                  onChange={() => setType("one_off")}
                  className="accent-[var(--accent)]"
                />
                Puntual
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="scale-type"
                  checked={type === "recurring"}
                  onChange={() => setType("recurring")}
                  className="accent-[var(--accent)]"
                />
                Recurrente
              </label>
              {type === "recurring" && (
                <label className="flex items-center gap-1.5 text-sm text-ink-2">
                  cada
                  <input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value) || 14)}
                    className="field w-16 px-2 py-1"
                  />
                  días
                </label>
              )}
              <button
                type="button"
                onClick={activate}
                disabled={pending}
                className="btn-primary"
              >
                Activar
              </button>
            </div>
          </div>
        )}
      </div>

      {assignments.length === 0 ? (
        <p className="text-sm text-ink-2">Ninguna escala activada todavía.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{a.scaleCode}</span>
                  <span className="chip">
                    {a.assignment_type === "recurring" ? "recurrente" : "puntual"}
                  </span>
                  {!a.active && <span className="chip">inactiva</span>}
                </div>
                <div className="mt-0.5 text-xs text-ink-3">
                  {a.latestScore != null
                    ? `Última: ${a.latestScore} · ${a.latestSeverity} · ${formatDate(a.latestAt)}`
                    : "Sin respuestas"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href={`/pro/patients/${patientId}/scales/${a.id}`}
                  className="btn-subtle btn-sm text-accent hover:text-accent"
                >
                  Ver evolución
                </Link>
                <button
                  type="button"
                  onClick={() => toggle(a.id, !a.active)}
                  disabled={pending}
                  className="btn-subtle btn-sm"
                >
                  {a.active ? "Desactivar" : "Reactivar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
