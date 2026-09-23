"use client";
import { callAction } from "@/lib/action-result";

import { useState } from "react";
import Link from "next/link";
import {
  createScaleAssignmentAction,
  setScaleAssignmentActiveAction,
} from "@/lib/actions/scales";
import { formatDate } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { Status } from "@/components/ui/Status";
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
  const { run, pending, error } = useAction();

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
    run(
      () =>
        callAction(createScaleAssignmentAction, {
          patientId,
          scaleId: chosen,
          type,
          intervalDays: type === "recurring" ? interval : null,
        }),
      () => setScaleId(""),
    );
  }

  function toggle(id: string, active: boolean) {
    run(() => callAction(setScaleAssignmentActiveAction, id, patientId, active));
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="section-title">Activar una escala (opt-in)</h2>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Sin activación, el paciente no ve ningún cuestionario.
        </p>
        {available.length === 0 ? (
          <p className="mt-3.5 text-[13.5px] text-ink-2">
            Todas las escalas del catálogo ya están activas para este paciente.
          </p>
        ) : (
          <div className="mt-4 flex max-w-xl flex-col gap-3">
            <label className="block">
              <span className="field-label">Escala</span>
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
            </label>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <label className="flex items-center gap-1.5 text-[13.5px]">
                <input
                  type="radio"
                  name="scale-type"
                  checked={type === "one_off"}
                  onChange={() => setType("one_off")}
                  className="accent-[var(--accent)]"
                />
                Puntual
              </label>
              <label className="flex items-center gap-1.5 text-[13.5px]">
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
                <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
                  cada
                  <input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value) || 14)}
                    className="field w-20"
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
      </section>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <section className="border-t border-line pt-7">
        <h2 className="section-title mb-1">Escalas del paciente</h2>
        {assignments.length === 0 ? (
          <p className="py-3 text-[13.5px] text-ink-3">
            Ninguna escala activada. Actívala arriba y le aparecerá al paciente.
          </p>
        ) : (
          <ul>
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line-soft py-3.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-[13.5px] font-medium">{a.scaleCode}</span>
                    <span className="chip">
                      {a.assignment_type === "recurring" ? "recurrente" : "puntual"}
                    </span>
                    {!a.active && <Status tone="neutral">inactiva</Status>}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-ink-3">
                    {a.latestScore != null
                      ? `Última respuesta el ${formatDate(a.latestAt)}, puntuación ${a.latestScore}, ${a.latestSeverity}`
                      : "Sin respuestas"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/pro/patients/${patientId}/scales/${a.id}`}
                    className="text-[13px] font-medium text-accent hover:underline"
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
      </section>
    </div>
  );
}
