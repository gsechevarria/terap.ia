"use client";

import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import {
  asignarExpedienteAction,
  retirarExpedienteAction,
} from "@/lib/actions/organizations";

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
    <section className="flex flex-col gap-3">
      <h3 className="section-title">Quién atiende este expediente</h3>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="table-wrap">
        <table className="table-base">
          <thead>
            <tr>
              <th>Profesional</th>
              <th className="text-right">
                <span className="sr-only">Acceso</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.nombre}</td>
                <td className="text-right">
                  {a.role === "primary" ? (
                    <span className="text-[12.5px] font-medium text-accent">
                      Profesional de referencia
                    </span>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {esCentro && (
        <div className="flex flex-col gap-2">
          {disponibles.length > 0 ? (
            <>
              <label className="field-label" htmlFor="asignar-a">
                Dar acceso a un compañero
              </label>
              <div className="flex gap-2">
                <select
                  id="asignar-a"
                  className="field min-w-0 flex-1"
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
                {/* `btn-lg` para que el alto cuadre con el del campo de 16 px. */}
                <button
                  type="button"
                  disabled={pending || !elegido}
                  onClick={() =>
                    run(async () => {
                      await callAction(asignarExpedienteAction, patientId, elegido);
                      setElegido("");
                    })
                  }
                  className="btn-primary btn-lg shrink-0"
                >
                  <UserPlus className="size-4" strokeWidth={2} aria-hidden />
                  Asignar
                </button>
              </div>
              <p className="text-[12.5px] leading-relaxed text-ink-3">
                Verá la historia completa del expediente. Podrá añadir sus
                propias anotaciones, pero no modificar ni borrar las tuyas.
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-ink-3">
              No queda nadie del equipo por asignar.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
