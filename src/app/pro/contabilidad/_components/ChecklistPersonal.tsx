"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { guardarChecklistAction } from "@/lib/actions/retenciones";
import type { Tables } from "@/lib/types";

/**
 * Documentación personal para la renta, separada de la contabilidad de la
 * actividad. No se construye aquí ningún motor de IRPF personal: se recoge qué
 * hay y qué falta, que es lo que el gestor pide.
 */
const ELEMENTOS: { clave: string; etiqueta: string; ayuda?: string }[] = [
  { clave: "declaracion_anterior", etiqueta: "Declaración del ejercicio anterior" },
  { clave: "datos_fiscales", etiqueta: "Datos fiscales de la AEAT" },
  {
    clave: "situacion_familiar",
    etiqueta: "Situación familiar y cambios durante el ejercicio",
    ayuda: "Matrimonio, nacimientos, divorcio, discapacidad reconocida…",
  },
  { clave: "rentas_trabajo", etiqueta: "Certificados de empleo u otras rentas" },
  { clave: "prestaciones", etiqueta: "Prestaciones por desempleo o Seguridad Social" },
  {
    clave: "inmuebles",
    etiqueta: "Inmuebles, alquileres y referencias catastrales",
    ayuda: "También los que no generan renta: la vivienda vacía imputa.",
  },
  { clave: "inversiones", etiqueta: "Intereses, inversiones, ganancias o pérdidas" },
  { clave: "planes_pensiones", etiqueta: "Planes de pensiones y aportaciones" },
  { clave: "donativos", etiqueta: "Donativos y cuotas a entidades" },
  {
    clave: "deducciones_autonomicas",
    etiqueta: "Documentación de deducciones autonómicas",
    ayuda: "La aplicación no calcula deducciones autonómicas: las aplica el gestor.",
  },
  {
    clave: "extranjero",
    etiqueta: "Rentas o bienes en el extranjero",
    ayuda: "Si existen, pueden implicar obligaciones informativas propias.",
  },
  { clave: "otros", etiqueta: "Otros documentos solicitados por el gestor" },
];

export function ChecklistPersonal({
  ejercicio,
  respuestas,
}: {
  ejercicio: number;
  respuestas: Tables<"checklist_personal">[];
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  const porClave = new Map(respuestas.map((r) => [r.clave, r]));
  const sinResponder = ELEMENTOS.filter((e) => (porClave.get(e.clave)?.aplica ?? null) === null);

  function responder(clave: string, aplica: boolean | null, aportado: boolean, notas: string) {
    run(async () => {
      await callAction(guardarChecklistAction, { ejercicio, clave, aplica, aportado, notas });
      router.refresh();
    });
  }

  return (
    <section className="card">
      <div className="border-b border-line p-6">
        <h2 className="card-title">Documentación personal</h2>
        <p className="mt-1.5 text-body-sm text-ink-2">
          Opcional y separado de la contabilidad de la actividad. Sirve para que
          el gestor sepa qué tiene y qué le falta; la aplicación no calcula nada
          de la renta personal.
        </p>
        {sinResponder.length > 0 && (
          <p className="mt-3 rounded-md bg-surface-muted px-4 py-2.5 text-[12.5px] text-ink-2">
            {sinResponder.length} sin responder. Dejarlo así es válido: el
            expediente no se presentará como completo, que es lo correcto.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>

      <ul className="divide-y divide-line">
        {ELEMENTOS.map((e) => {
          const r = porClave.get(e.clave);
          const aplica = r?.aplica ?? null;
          const estaAbierto = abierto === e.clave;
          return (
            <li key={e.clave} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{e.etiqueta}</p>
                  {e.ayuda && <p className="mt-0.5 text-[11px] text-ink-3">{e.ayuda}</p>}
                  {r?.notas && <p className="mt-1 text-[12px] text-ink-2">{r.notas}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Tres estados. "Sin responder" no es "no aplica". */}
                  <button
                    type="button"
                    disabled={pending}
                    aria-pressed={aplica === true}
                    onClick={() => responder(e.clave, true, r?.aportado ?? false, r?.notas ?? "")}
                    className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                      aplica === true
                        ? "border-accent/30 bg-accent-soft text-accent"
                        : "border-line bg-surface-subtle text-ink-2 hover:text-ink"
                    }`}
                  >
                    Aplica
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-pressed={aplica === false}
                    onClick={() => responder(e.clave, false, false, r?.notas ?? "")}
                    className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                      aplica === false
                        ? "border-line-strong bg-sunken text-ink"
                        : "border-line bg-surface-subtle text-ink-2 hover:text-ink"
                    }`}
                  >
                    No aplica
                  </button>
                  {aplica === true && (
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={r?.aportado ?? false}
                      onClick={() => responder(e.clave, true, !(r?.aportado ?? false), r?.notas ?? "")}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                        r?.aportado
                          ? "border-success/30 bg-success-soft text-success"
                          : "border-warning-line bg-warning-soft text-warning-ink"
                      }`}
                    >
                      {r?.aportado ? "Aportado" : "Falta aportar"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAbierto(estaAbierto ? null : e.clave);
                      setNota(r?.notas ?? "");
                    }}
                    className="btn-subtle btn-sm"
                  >
                    Nota
                  </button>
                </div>
              </div>

              {estaAbierto && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={nota}
                    onChange={(ev) => setNota(ev.target.value)}
                    placeholder="Detalle para el gestor"
                    className="field max-w-sm"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      responder(e.clave, aplica, r?.aportado ?? false, nota);
                      setAbierto(null);
                    }}
                    className="btn-ghost btn-sm"
                  >
                    Guardar nota
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
