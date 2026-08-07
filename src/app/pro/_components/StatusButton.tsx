"use client";

import { setPatientStatusAction } from "@/lib/actions/patients";
import { useAction } from "@/lib/use-action";
import type { PatientStatus } from "@/lib/types";

export function StatusButton({
  patientId,
  status,
}: {
  patientId: string;
  status: PatientStatus;
}) {
  const { run, pending, error } = useAction();
  const next: PatientStatus = status === "active" ? "archived" : "active";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setPatientStatusAction(patientId, next))}
        className="btn-ghost"
      >
        {pending ? "…" : status === "active" ? "Archivar" : "Reactivar"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
