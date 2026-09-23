"use client";
import { callAction } from "@/lib/action-result";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { acknowledgeFlaggedResponseAction } from "@/lib/actions/scale-responses";
import { formatDateTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import type { FlaggedResponse } from "@/lib/queries/scales";

/**
 * Alertas de ítem de riesgo pendientes de revisar, con acuse de recibo.
 *
 * El acuse es lo que convierte el contador en una señal útil: sin él, el banner
 * cuenta el histórico completo, no vuelve nunca a cero y se acaba ignorando.
 * Marcar "Visto" NO borra nada: solo registra quién la revisó y cuándo.
 *
 * Enuncia qué marcó el paciente y cuándo. No dice qué significa: esa lectura es
 * del profesional.
 */
export function FlaggedAlerts({
  patientId,
  responses,
}: {
  patientId: string;
  responses: FlaggedResponse[];
}) {
  const { run, pending, error } = useAction();
  if (responses.length === 0) return null;

  return (
    <div role="alert" className="alert-clinical mt-4">
      <TriangleAlert
        size={18}
        strokeWidth={1.75}
        aria-hidden
        className="mt-0.5 shrink-0 text-danger"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-danger-ink">
          {responses.length} respuesta{responses.length > 1 ? "s" : ""} con el
          ítem de riesgo marcado, pendiente
          {responses.length > 1 ? "s" : ""} de revisar.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {responses.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2"
            >
              <span className="text-[12.5px] text-ink-2">
                {r.scaleCode}, {formatDateTime(r.submittedAt)}
              </span>
              <span className="flex items-center gap-2">
                <Link
                  href={`/pro/patients/${patientId}/scales/${r.assignmentId}`}
                  className="btn-ghost btn-sm"
                >
                  Ver respuesta
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      callAction(acknowledgeFlaggedResponseAction, r.id, patientId),
                    )
                  }
                  className="btn-subtle btn-sm"
                >
                  Marcar como revisada
                </button>
              </span>
            </li>
          ))}
        </ul>
        {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
      </div>
    </div>
  );
}
