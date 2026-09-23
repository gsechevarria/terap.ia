"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import {
  abrirExpedienteAction,
  cambiarEstadoExpedienteAction,
  guardarNotaGestorAction,
} from "@/lib/actions/expediente";
import { formatDateTime } from "@/lib/format";
import type { Enums } from "@/lib/database.types";

type PasoIncompleto = { clave: string; titulo: string; faltan: string[] };

/**
 * Estados del expediente y nota para la gestoría.
 *
 * "Revisado" pide el nombre de quien revisa. NO es una aprobación profesional
 * del gestor: es la constancia de que alguien de la consulta lo ha repasado, y
 * así se dice en pantalla. Confundir ambas cosas sería atribuir una validación
 * que nadie ha hecho.
 */
export function EstadoExpediente({
  ejercicio,
  estado,
  revisadoPor,
  revisadoAt,
  notaGestor,
  existe,
  pasosIncompletos,
}: {
  ejercicio: number;
  estado: Enums<"estado_expediente">;
  revisadoPor: string | null;
  revisadoAt: string | null;
  notaGestor: string | null;
  existe: boolean;
  pasosIncompletos: PasoIncompleto[];
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [nombre, setNombre] = useState(revisadoPor ?? "");
  const [nota, setNota] = useState(notaGestor ?? "");

  if (!existe) {
    return (
      <section className="card p-6">
        <h2 className="card-title">Expediente sin abrir</h2>
        <p className="mt-1.5 text-body-sm text-ink-2">
          Todavía no hay expediente para {ejercicio}. Ábralo para poder marcar su
          estado y dejar la nota para la gestoría.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await callAction(abrirExpedienteAction, ejercicio);
              router.refresh();
            })
          }
          className="btn-primary mt-4"
        >
          {pending ? "Abriendo…" : `Abrir expediente ${ejercicio}`}
        </button>
      </section>
    );
  }

  function cambiar(siguiente: Enums<"estado_expediente">) {
    run(async () => {
      await callAction(cambiarEstadoExpedienteAction, ejercicio, siguiente, nombre);
      router.refresh();
    });
  }

  return (
    <section className="card p-6">
      <h2 className="card-title">Estado del expediente</h2>

      {pasosIncompletos.length > 0 && (
        <div className="mt-3 rounded-md bg-warning-soft px-4 py-3 text-[12.5px] text-warning-ink">
          <p className="font-medium">
            Quedan {pasosIncompletos.length} pasos sin completar. Puede marcarlo
            igualmente: un expediente incompleto identificado como tal es más
            útil que ninguno.
          </p>
          <ul className="mt-1.5 list-inside list-disc">
            {pasosIncompletos.map((p) => (
              <li key={p.clave}>
                {p.titulo}
                {p.faltan[0] ? ` — ${p.faltan[0]}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      <label className="mt-5 block">
        <span className="field-label">Nota para la gestoría</span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Dudas, ajustes manuales o cualquier cosa que su gestor deba saber."
          className="field"
        />
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(async () => {
            await callAction(guardarNotaGestorAction, ejercicio, nota);
            router.refresh();
          })
        }
        className="btn-ghost btn-sm mt-2"
      >
        Guardar nota
      </button>

      <div className="mt-6 border-t border-line pt-5">
        <label className="block">
          <span className="field-label">Quién revisa el expediente</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellidos"
            className="field"
          />
          <span className="mt-1.5 block text-[11px] text-ink-3">
            Queda registrado quién y cuándo. No implica aprobación del gestor:
            es la constancia de que alguien de la consulta lo ha repasado.
          </span>
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || estado === "pendiente_informacion"}
            onClick={() => cambiar("pendiente_informacion")}
            className="btn-ghost btn-sm"
          >
            Pendiente de información
          </button>
          <button
            type="button"
            disabled={pending || estado === "preparado_revision"}
            onClick={() => cambiar("preparado_revision")}
            className="btn-ghost btn-sm"
          >
            Preparado para revisión
          </button>
          <button
            type="button"
            disabled={pending || estado === "revisado" || nombre.trim() === ""}
            onClick={() => cambiar("revisado")}
            className="btn-primary btn-sm"
          >
            Marcar como revisado
          </button>
          {estado !== "borrador" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => cambiar("borrador")}
              className="btn-subtle btn-sm"
            >
              Volver a borrador
            </button>
          )}
        </div>

        {estado === "revisado" && revisadoAt && (
          <p className="mt-3 text-[12px] text-ink-2">
            Revisado por <strong className="font-medium text-ink">{revisadoPor}</strong> el{" "}
            {formatDateTime(revisadoAt)}.
          </p>
        )}
      </div>
    </section>
  );
}
