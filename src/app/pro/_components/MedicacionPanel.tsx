"use client";
import { useState } from "react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import {
  guardarMedicamentoAction,
  setRetiradoMedicamentoAction,
  setSituacionMedicacionAction,
  setVisibilidadMedicacionAction,
} from "@/lib/actions/medicacion";
import {
  CON_COMIDA,
  CON_COMIDA_LABEL,
  DIAS,
  DIA_CORTO,
  FRECUENCIAS,
  FRECUENCIA_LABEL,
  MOMENTOS,
  MOMENTO_LABEL,
  describeFrecuencia,
  describeMomentos,
  type Medicamento,
  type MedicamentoInput,
} from "@/lib/medicacion";
import type { AjustesMedicacion, CambioMedicacion } from "@/lib/queries/medicacion";
import { DateField } from "@/components/ui/DateField";
import { Status } from "@/components/ui/Status";
import { formatDate, formatDateTime } from "@/lib/format";

/*
 * Pestaña «Medicación» de la ficha. Transcripción de la pauta del médico del
 * paciente: el panel no calcula, no compara y no sugiere nada. Sin avisos en
 * pantalla por decisión del 6-oct; el «Prescrito por» obligatorio ya lo deja
 * claro.
 */

type Borrador = {
  nombre: string;
  dosis: string;
  momentos: string[];
  horario: string;
  frecuencia: string;
  dias_semana: number[];
  con_comida: string;
  instrucciones: string;
  prescrito_por: string;
  fecha_inicio: string;
  fecha_fin: string;
};

const VACIO: Borrador = {
  nombre: "",
  dosis: "",
  momentos: [],
  horario: "",
  frecuencia: "diaria",
  dias_semana: [],
  con_comida: "indiferente",
  instrucciones: "",
  prescrito_por: "",
  fecha_inicio: "",
  fecha_fin: "",
};

function desde(m: Medicamento): Borrador {
  return {
    nombre: m.nombre,
    dosis: m.dosis,
    momentos: m.momentos,
    horario: m.horario ?? "",
    frecuencia: m.frecuencia,
    dias_semana: m.dias_semana,
    con_comida: m.con_comida,
    instrucciones: m.instrucciones ?? "",
    prescrito_por: m.prescrito_por,
    fecha_inicio: m.fecha_inicio ?? "",
    fecha_fin: m.fecha_fin ?? "",
  };
}

const chip = (activo: boolean) =>
  `rounded-lg border px-3 py-1 text-sm font-medium transition-colors duration-150 ${
    activo
      ? "border-accent bg-accent-soft text-accent"
      : "border-line-strong bg-canvas text-ink-2 hover:bg-wash hover:text-ink"
  }`;

export function MedicacionPanel({
  patientId,
  ajustes,
  medicamentos,
  cambios,
}: {
  patientId: string;
  ajustes: AjustesMedicacion;
  medicamentos: Medicamento[];
  cambios: CambioMedicacion[];
}) {
  const { run, pending, error } = useAction();
  const [editando, setEditando] = useState<string | "nuevo" | null>(null);

  const vigentes = medicamentos.filter((m) => !m.retirada_at);
  const retirados = medicamentos.filter((m) => m.retirada_at);

  return (
    <div className="flex flex-col gap-8">
      {/* Visibilidad y situación */}
      <section className="flex flex-col gap-5">
        <div className="max-w-xl">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] font-medium">
            <input
              type="checkbox"
              checked={ajustes.visible_paciente}
              disabled={pending}
              onChange={(e) =>
                run(() => callAction(setVisibilidadMedicacionAction, patientId, e.target.checked))
              }
            />
            Mostrar la pauta en la app del paciente
          </label>
        </div>

        <div>
          <span className="field-label">Situación</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Situación de la medicación">
            {(
              [
                [null, "Sin indicar"],
                [false, "No requiere medicación"],
                [true, "Con pauta de medicación"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={String(valor)}
                type="button"
                disabled={pending}
                aria-pressed={ajustes.requiere_medicacion === valor}
                onClick={() =>
                  run(() => callAction(setSituacionMedicacionAction, patientId, valor))
                }
                className={chip(ajustes.requiere_medicacion === valor)}
              >
                {texto}
              </button>
            ))}
          </div>
          {ajustes.requiere_medicacion === false && vigentes.length > 0 && (
            <p className="mt-2 text-[12.5px] text-warning-ink">
              Hay medicamentos sin retirar. El paciente verá «no requiere
              medicación» y no verá la lista: retíralos o cambia la situación.
            </p>
          )}
        </div>
      </section>

      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}

      {/* Pauta vigente */}
      <section className="border-t border-line pt-7">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">Pauta actual</h2>
          {editando !== "nuevo" && (
            <button type="button" onClick={() => setEditando("nuevo")} className="btn-primary btn-sm">
              Añadir medicamento
            </button>
          )}
        </div>

        {editando === "nuevo" && (
          <FormularioMedicamento
            key="nuevo"
            inicial={VACIO}
            pending={pending}
            onCancelar={() => setEditando(null)}
            onGuardar={(datos) =>
              run(
                () => callAction(guardarMedicamentoAction, { patientId, datos }),
                () => setEditando(null),
              )
            }
          />
        )}

        {vigentes.length === 0 && editando !== "nuevo" ? (
          <p className="py-3 text-[13.5px] text-ink-3">
            No hay ningún medicamento anotado.
          </p>
        ) : (
          <ul>
            {vigentes.map((m) =>
              editando === m.id ? (
                <li key={m.id} className="border-b border-line-soft py-4 last:border-b-0">
                  <FormularioMedicamento
                    inicial={desde(m)}
                    pending={pending}
                    onCancelar={() => setEditando(null)}
                    onGuardar={(datos) =>
                      run(
                        () => callAction(guardarMedicamentoAction, { patientId, id: m.id, datos }),
                        () => setEditando(null),
                      )
                    }
                  />
                </li>
              ) : (
                <FilaMedicamento key={m.id} m={m}>
                  <button type="button" onClick={() => setEditando(m.id)} className="btn-subtle btn-sm">
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`¿Retirar ${m.nombre} de la pauta? Quedará en el historial.`)) {
                        run(() =>
                          callAction(setRetiradoMedicamentoAction, { patientId, id: m.id, retirado: true }),
                        );
                      }
                    }}
                    className="btn-subtle btn-sm text-warn hover:text-warn"
                  >
                    Retirar
                  </button>
                </FilaMedicamento>
              ),
            )}
          </ul>
        )}
      </section>

      {retirados.length > 0 && (
        <section className="border-t border-line pt-7">
          <h2 className="section-title mb-1">
            Retirados <span className="text-ink-3">{retirados.length}</span>
          </h2>
          <ul>
            {retirados.map((m) => (
              <FilaMedicamento key={m.id} m={m} retirado>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      callAction(setRetiradoMedicamentoAction, { patientId, id: m.id, retirado: false }),
                    )
                  }
                  className="btn-subtle btn-sm"
                >
                  Volver a la pauta
                </button>
              </FilaMedicamento>
            ))}
          </ul>
        </section>
      )}

      <RegistroCambios cambios={cambios} />
    </div>
  );
}

function FilaMedicamento({
  m,
  retirado,
  children,
}: {
  m: Medicamento;
  retirado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="border-b border-line-soft py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className={`min-w-0 ${retirado ? "text-ink-3" : ""}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[13.5px] font-medium">{m.nombre}</span>
            <span className="text-[13.5px]">{m.dosis}</span>
            {retirado && m.retirada_at && (
              <Status tone="neutral">retirado el {formatDate(m.retirada_at)}</Status>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-ink-2">
            {describeFrecuencia(m)}
            {m.momentos.length > 0 && <> · {describeMomentos(m)}</>}
            {m.horario && <> · {m.horario}</>}
            {m.con_comida !== "indiferente" && (
              <> · {CON_COMIDA_LABEL[m.con_comida as keyof typeof CON_COMIDA_LABEL] ?? m.con_comida}</>
            )}
          </p>
          {m.instrucciones && (
            <p className="mt-1 text-[12.5px] whitespace-pre-wrap text-ink-2">{m.instrucciones}</p>
          )}
          <p className="mt-1 text-[12px] text-ink-3">
            Prescrito por {m.prescrito_por}
            {m.fecha_inicio && <> · desde {formatDate(m.fecha_inicio)}</>}
            {m.fecha_fin && <> · hasta {formatDate(m.fecha_fin)}</>}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">{children}</div>
      </div>
    </li>
  );
}

function FormularioMedicamento({
  inicial,
  pending,
  onGuardar,
  onCancelar,
}: {
  inicial: Borrador;
  pending: boolean;
  onGuardar: (datos: MedicamentoInput) => void;
  onCancelar: () => void;
}) {
  const [b, setB] = useState<Borrador>(inicial);
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }));
  const alterna = <T,>(lista: T[], v: T) =>
    lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];

  const listo =
    b.nombre.trim() &&
    b.dosis.trim() &&
    b.prescrito_por.trim() &&
    (b.frecuencia === "si_precisa" || b.momentos.length > 0) &&
    (b.frecuencia !== "dias_semana" || b.dias_semana.length > 0);

  return (
    <div className="my-3 grid max-w-3xl gap-3 rounded-[10px] border border-line p-4 sm:grid-cols-2">
      <label className="block">
        <span className="field-label">Medicamento</span>
        <input value={b.nombre} onChange={(e) => set("nombre", e.target.value)} maxLength={200} className="field" />
      </label>
      <label className="block">
        <span className="field-label">Dosis</span>
        <input
          value={b.dosis}
          onChange={(e) => set("dosis", e.target.value)}
          placeholder="p. ej. 50 mg, 1 comprimido"
          maxLength={200}
          className="field"
        />
      </label>

      <label className="block">
        <span className="field-label">Frecuencia</span>
        <select value={b.frecuencia} onChange={(e) => set("frecuencia", e.target.value)} className="field">
          {FRECUENCIAS.map((f) => (
            <option key={f} value={f}>{FRECUENCIA_LABEL[f]}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">Cómo tomarla</span>
        <select value={b.con_comida} onChange={(e) => set("con_comida", e.target.value)} className="field">
          {CON_COMIDA.map((c) => (
            <option key={c} value={c}>{CON_COMIDA_LABEL[c]}</option>
          ))}
        </select>
      </label>

      {b.frecuencia === "dias_semana" && (
        <div className="sm:col-span-2">
          <span className="field-label">Días</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días de la semana">
            {DIAS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={b.dias_semana.includes(d)}
                onClick={() => set("dias_semana", alterna(b.dias_semana, d))}
                className={chip(b.dias_semana.includes(d))}
              >
                {DIA_CORTO[d]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sm:col-span-2">
        <span className="field-label">
          Cuándo {b.frecuencia === "si_precisa" && <span className="text-ink-3">(opcional)</span>}
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Momentos del día">
          {MOMENTOS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={b.momentos.includes(m)}
              onClick={() => set("momentos", alterna(b.momentos, m))}
              className={chip(b.momentos.includes(m))}
            >
              {MOMENTO_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="field-label">Hora concreta (opcional)</span>
        <input
          value={b.horario}
          onChange={(e) => set("horario", e.target.value)}
          placeholder="p. ej. 8:00 y 20:00"
          maxLength={120}
          className="field"
        />
      </label>
      <label className="block">
        <span className="field-label">Prescrito por</span>
        <input
          value={b.prescrito_por}
          onChange={(e) => set("prescrito_por", e.target.value)}
          placeholder="Nombre del médico o psiquiatra"
          maxLength={200}
          className="field"
        />
      </label>

      <DateField
        name="fecha_inicio"
        label="Desde (opcional)"
        defaultValue={b.fecha_inicio || null}
        anios="futuro"
        onChange={(v) => set("fecha_inicio", v)}
      />
      <DateField
        name="fecha_fin"
        label="Hasta (opcional)"
        defaultValue={b.fecha_fin || null}
        anios="futuro"
        onChange={(v) => set("fecha_fin", v)}
      />

      <label className="block sm:col-span-2">
        <span className="field-label">Instrucciones (opcional)</span>
        <textarea
          value={b.instrucciones}
          onChange={(e) => set("instrucciones", e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Lo que haya indicado el médico, con sus palabras"
          className="field"
        />
      </label>

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          disabled={pending || !listo}
          onClick={() =>
            onGuardar({
              ...b,
              momentos: b.momentos as MedicamentoInput["momentos"],
              frecuencia: b.frecuencia as MedicamentoInput["frecuencia"],
              con_comida: b.con_comida as MedicamentoInput["con_comida"],
            })
          }
          className="btn-primary btn-sm"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onCancelar} className="btn-subtle btn-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

const ACCION: Record<string, string> = {
  alta: "Añadió",
  cambio: "Cambió",
  retirada: "Retiró",
  reactivada: "Volvió a la pauta",
  visibilidad: "Visibilidad",
  situacion: "Situación",
};

const CAMPO: Record<string, string> = {
  nombre: "medicamento",
  dosis: "dosis",
  momentos: "momentos",
  horario: "hora",
  frecuencia: "frecuencia",
  dias_semana: "días",
  con_comida: "cómo tomarla",
  instrucciones: "instrucciones",
  prescrito_por: "prescriptor",
  fecha_inicio: "inicio",
  fecha_fin: "fin",
};

/** Qué cambió, en palabras: «dosis, hora». Sin valores: el detalle está en la base. */
function camposCambiados(c: CambioMedicacion): string {
  if (!c.antes || !c.despues) return "";
  return Object.keys(CAMPO)
    .filter((k) => JSON.stringify(c.antes![k]) !== JSON.stringify(c.despues![k]))
    .map((k) => CAMPO[k])
    .join(", ");
}

function detalle(c: CambioMedicacion): string {
  if (c.accion === "visibilidad") {
    return c.despues?.visible_paciente ? "visible en la app del paciente" : "oculta en la app del paciente";
  }
  if (c.accion === "situacion") {
    const v = c.despues?.requiere_medicacion;
    return v === true ? "con pauta de medicación" : v === false ? "no requiere medicación" : "sin indicar";
  }
  const nombre = c.medicamento ?? (c.despues?.nombre as string | undefined) ?? "medicamento";
  if (c.accion === "cambio") {
    const campos = camposCambiados(c);
    return campos ? `${nombre}: ${campos}` : nombre;
  }
  return nombre;
}

function RegistroCambios({ cambios }: { cambios: CambioMedicacion[] }) {
  if (cambios.length === 0) return null;
  return (
    <section className="border-t border-line pt-7">
      <details>
        <summary className="section-title cursor-pointer">
          Registro de cambios <span className="text-ink-3">{cambios.length}</span>
        </summary>
        <ul className="mt-2">
          {cambios.map((c) => (
            <li key={c.id} className="flex flex-wrap gap-x-3 border-b border-line-soft py-2 text-[12.5px] last:border-b-0">
              <span className="text-ink-3">{formatDateTime(c.created_at)}</span>
              <span className="font-medium">{ACCION[c.accion] ?? c.accion}</span>
              <span className="text-ink-2">{detalle(c)}</span>
              {c.autor && <span className="text-ink-3">· {c.autor}</span>}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
