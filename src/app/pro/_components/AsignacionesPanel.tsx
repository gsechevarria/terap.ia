"use client";

import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import {
  asignarExpedienteAction,
  retirarExpedienteAction,
} from "@/lib/actions/organizations";
import { Status } from "@/components/ui/Status";

type Asignacion = {
  id: string;
  professionalId: string;
  nombre: string;
  role: "primary" | "collaborator";
};

/**
 * Quién puede abrir este expediente.
 *
 * Es la única puerta al contenido clínico: pertenecer al centro no basta y
 * administrarlo tampoco. Quien asigna tiene que tener acceso él mismo, así que
 * un administrador que no atiende a este paciente no puede repartirlo.
 *
 * El profesional de referencia no se retira: dejaría el expediente sin nadie
 * que responda por él.
 */
export function AsignacionesPanel({
  patientId,
  asignaciones,
  equipo,
  esCentro,
}: {
  patientId: string;
  asignaciones: Asignacion[];
  /** Compañeros del centro que aún no están asignados. */
  equipo: { professionalId: string; nombre: string }[];
  esCentro: boolean;
}) {
  const { run, pending, error } = useAction();
  const [elegido, setElegido] = useState("");

  const disponibles = equipo.filter(
    (m) => !asignaciones.some((a) => a.professionalId === m.professionalId),
  );

  return (
    <div className="card bg-panel p-4">
      <h3 className="section-label">Quién atiende este expediente</h3>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <ul className="mt-3 flex flex-col gap-2">
        {asignaciones.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
            {a.role === "primary" ? (
              <Status tone="accent">referencia</Status>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => callAction(retirarExpedienteAction, patientId, a.professionalId))
                }
                className="btn-danger btn-sm"
                aria-label={`Retirar acceso a ${a.nombre}`}
              >
                <UserMinus className="size-3.5" strokeWidth={2} aria-hidden />
                Retirar
              </button>
            )}
          </li>
        ))}
      </ul>

      {esCentro && (
        <div className="mt-4 flex flex-col gap-2">
          {disponibles.length > 0 ? (
            <>
              <label className="field-label" htmlFor="asignar-a">
                Dar acceso a un compañero
              </label>
              <div className="flex gap-2">
                <select
                  id="asignar-a"
                  className="field min-w-0 flex-1 text-sm"
                  value={elegido}
                  onChange={(e) => setElegido(e.target.value)}
                >
                  <option value="">Elegir…</option>
                  {disponibles.map((m) => (
                    <option key={m.professionalId} value={m.professionalId}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending || !elegido}
                  onClick={() =>
                    run(async () => {
                      await callAction(asignarExpedienteAction, patientId, elegido);
                      setElegido("");
                    })
                  }
                  className="btn-primary shrink-0"
                >
                  <UserPlus className="size-4" strokeWidth={2} aria-hidden />
                  Asignar
                </button>
              </div>
              <p className="text-xs leading-relaxed text-ink-3">
                Verá la historia completa del expediente. Podrá añadir sus
                propias anotaciones, pero no modificar ni borrar las tuyas.
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-3">
              No queda nadie del equipo por asignar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
