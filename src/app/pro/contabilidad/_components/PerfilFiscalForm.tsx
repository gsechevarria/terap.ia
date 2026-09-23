"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import { guardarPerfilFiscalAction } from "@/lib/actions/expediente";
import { NOMBRE_TERRITORIO, TERRITORIOS } from "@/lib/fiscal/reglas";
import type { ConfiguracionFiscal } from "@/lib/types";
import type { Enums } from "@/lib/database.types";

/**
 * Tres estados, no dos.
 *
 * Un `select` con Sí y No obliga a contestar algo, y quien no lo sabe acaba
 * marcando "No". Eso determinaría obligaciones formales —el 111 y el 115— sobre
 * una pregunta que nadie ha contestado, así que "No lo sé" es una opción de
 * primera clase y se guarda como `null`.
 */
function TresEstados({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const texto = valor === null ? "" : valor ? "si" : "no";
  return (
    <label className="block">
      <span className="field-label">{etiqueta}</span>
      <select
        value={texto}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value === "si")
        }
        className="field"
      >
        <option value="">No lo sé</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}

export function PerfilFiscalForm({
  config,
  faltan,
}: {
  config: ConfiguracionFiscal | null;
  faltan: string[];
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();

  const [territorio, setTerritorio] = useState<Enums<"territorio_fiscal">>(
    (config?.territorio as Enums<"territorio_fiscal">) ?? "comun",
  );
  const [confirmado, setConfirmado] = useState(config?.territorio_confirmado ?? false);
  const [ccaa, setCcaa] = useState(config?.comunidad_autonoma ?? "");
  const [criterio, setCriterio] = useState<Enums<"criterio_imputacion">>(
    (config?.criterio_imputacion as Enums<"criterio_imputacion">) ?? "devengo",
  );
  const [baja, setBaja] = useState(config?.fecha_baja_actividad ?? "");
  const [empleados, setEmpleados] = useState<boolean | null>(config?.tiene_empleados ?? null);
  const [colaboradores, setColaboradores] = useState<boolean | null>(
    config?.tiene_colaboradores ?? null,
  );
  const [alquileres, setAlquileres] = useState<boolean | null>(config?.tiene_alquileres ?? null);
  const [internacional, setInternacional] = useState<boolean | null>(
    config?.operaciones_internacionales ?? null,
  );
  const [consulta, setConsulta] = useState(config?.tipo_consulta ?? "");

  if (!config) {
    return (
      <section className="card p-6">
        <h2 className="card-title">Perfil fiscal</h2>
        <p className="mt-1.5 text-body-sm text-ink-2">
          Todavía no hay configuración fiscal. Créela antes de continuar: sin
          régimen ni situación de IVA no se puede determinar nada.
        </p>
        <a href="/pro/contabilidad/configuracion" className="btn-primary mt-4">
          Crear configuración fiscal
        </a>
      </section>
    );
  }

  function guardar() {
    run(async () => {
      await callAction(guardarPerfilFiscalAction, {
        territorio,
        territorioConfirmado: confirmado,
        comunidadAutonoma: ccaa,
        criterioImputacion: criterio,
        fechaBajaActividad: baja || null,
        tieneEmpleados: empleados,
        tieneColaboradores: colaboradores,
        tieneAlquileres: alquileres,
        operacionesInternacionales: internacional,
        tipoConsulta: consulta,
      });
      router.refresh();
    });
  }

  return (
    <section className="card p-6">
      <h2 className="card-title">Perfil fiscal</h2>
      <p className="mt-1.5 text-body-sm text-ink-2">
        Lo que determina qué reglas aplican y qué modelos corresponden. Lo que no
        se sepa se deja sin responder: un dato ausente deja la obligación
        pendiente, y eso es más útil que una respuesta inventada.
      </p>

      {faltan.length > 0 && (
        <ul className="mt-4 list-inside list-disc rounded-md bg-warning-soft px-4 py-3 text-[12.5px] text-warning-ink">
          {faltan.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Territorio fiscal</span>
          <select
            value={territorio}
            onChange={(e) => setTerritorio(e.target.value as Enums<"territorio_fiscal">)}
            className="field"
          >
            {TERRITORIOS.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TERRITORIO[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="field-label">Comunidad autónoma</span>
          <input
            value={ccaa}
            onChange={(e) => setCcaa(e.target.value)}
            placeholder="Madrid, Cataluña…"
            className="field"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="field-label">Criterio de imputación temporal</span>
          <select
            value={criterio}
            onChange={(e) => setCriterio(e.target.value as Enums<"criterio_imputacion">)}
            className="field"
          >
            <option value="devengo">Devengo (regla general)</option>
            <option value="cobros_pagos">Cobros y pagos (opción ejercida)</option>
            <option value="desconocido">No lo sé</option>
          </select>
          {criterio === "cobros_pagos" && (
            <span className="mt-1.5 block text-[11px] text-ink-3">
              El criterio de cobros y pagos requiere haber ejercido la opción.
              Conserve el justificante: su gestor lo pedirá.
            </span>
          )}
        </label>

        <label className="block">
          <span className="field-label">Fecha de baja en la actividad</span>
          <input
            type="date"
            value={baja}
            onChange={(e) => setBaja(e.target.value)}
            className="field"
          />
        </label>

        <label className="block">
          <span className="field-label">Consulta</span>
          <select
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            className="field"
          >
            <option value="">Sin especificar</option>
            <option value="propia">Propia</option>
            <option value="alquilada">Alquilada</option>
            <option value="compartida">Compartida</option>
            <option value="domicilio">Domicilio parcialmente afecto</option>
          </select>
        </label>

        <TresEstados etiqueta="¿Tiene empleados?" valor={empleados} onChange={setEmpleados} />
        <TresEstados
          etiqueta="¿Paga a colaboradores con retención?"
          valor={colaboradores}
          onChange={setColaboradores}
        />
        <TresEstados
          etiqueta="¿Paga alquiler con retención?"
          valor={alquileres}
          onChange={setAlquileres}
        />
        <TresEstados
          etiqueta="¿Opera con el extranjero?"
          valor={internacional}
          onChange={setInternacional}
        />
      </div>

      <div className="mt-5 rounded-md bg-surface-muted p-3">
        <label className="flex items-start gap-2.5 text-[13px] font-medium text-ink">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          Confirmo que este es mi territorio fiscal
        </label>
        <p className="mt-1 pl-6.5 text-[11px] text-ink-2">
          Mientras no se confirme, la aplicación asume territorio común y lo
          advierte en el expediente y en la exportación.
        </p>
      </div>

      <button type="button" disabled={pending} onClick={guardar} className="btn-primary mt-5">
        {pending ? "Guardando…" : "Guardar perfil"}
      </button>
    </section>
  );
}
