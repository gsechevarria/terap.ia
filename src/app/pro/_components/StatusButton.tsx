"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPatientStatusAction } from "@/lib/actions/patients";
import type { PatientStatus } from "@/lib/types";

export function StatusButton({
  patientId,
  status,
}: {
  patientId: string;
  status: PatientStatus;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const next: PatientStatus = status === "active" ? "archived" : "active";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setPatientStatusAction(patientId, next);
          router.refresh();
        })
      }
      className="btn-ghost"
    >
      {pending ? "…" : status === "active" ? "Archivar" : "Reactivar"}
    </button>
  );
}
