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
      <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <h3 className="text-sm font-semibold">Activar una escala (opt-in)</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Sin activación, el paciente no ve ningún cuestionario.
        </p>
        {available.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Todas las escalas del catálogo ya están activas para este paciente.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <select
              value={scaleId || available[0]?.id}
              onChange={(e) => setScaleId(e.target.value)}
              className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.16]"
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
                />
                Puntual
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="scale-type"
                  checked={type === "recurring"}
                  onChange={() => setType("recurring")}
                />
                Recurrente
              </label>
              {type === "recurring" && (
                <label className="flex items-center gap-1.5 text-sm text-neutral-500">
                  cada
                  <input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value) || 14)}
                    className="w-16 rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm dark:border-white/[.16]"
                  />
                  días
                </label>
              )}
              <button
                type="button"
                onClick={activate}
                disabled={pending}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
              >
                Activar
              </button>
            </div>
          </div>
        )}
      </div>

      {assignments.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Ninguna escala activada todavía.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.12]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.scaleCode}</span>
                  <span className="text-xs text-neutral-500">
                    {a.assignment_type === "recurring" ? "recurrente" : "puntual"}
                  </span>
                  {!a.active && (
                    <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                      inactiva
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {a.latestScore != null
                    ? `Última: ${a.latestScore} · ${a.latestSeverity} · ${formatDate(a.latestAt)}`
                    : "Sin respuestas"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/pro/patients/${patientId}/scales/${a.id}`}
                  className="text-sm text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-300"
                >
                  Ver evolución
                </Link>
                <button
                  type="button"
                  onClick={() => toggle(a.id, !a.active)}
                  disabled={pending}
                  className="text-sm text-neutral-500 underline disabled:opacity-60"
                >
                  {a.active ? "desactivar" : "reactivar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
