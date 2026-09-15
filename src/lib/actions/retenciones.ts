"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfessional } from "@/lib/queries/identity";
import type { Enums } from "@/lib/database.types";

const eurosACentimos = (euros: number) => Math.round(euros * 100);

function revalidar(ejercicio: number): void {
  revalidatePath(`/pro/contabilidad/expediente/${ejercicio}`);
}

const PERIODOS = ["1T", "2T", "3T", "4T", "anual"];

/**
 * Retenciones y pagos a cuenta.
 *
 * Las cuatro clases NO se mezclan, y esa es la razón de que la tabla exista:
 *
 *   · `soportada_cliente`      — se la practicaron al profesional. Es un pago a
 *     cuenta de SU IRPF; no reduce los ingresos de la actividad.
 *   · `practicada_colaborador` — la practicó él a un tercero. Es una deuda con
 *     Hacienda que declara en el 111 o el 115.
 *   · `pago_fraccionado_irpf`  — modelo 130.
 *   · `liquidacion_iva`        — modelo 303.
 *
 * Sumarlas en un único saldo produce un número que no significa nada, así que
 * cada una se registra con su clase y el resumen las presenta por separado.
 */
async function guardarRetencionActionImpl(entrada: {
  id?: string;
  ejercicio: number;
  clase: Enums<"clase_retencion">;
  periodo: string;
  modelo: string;
  importeEuros: number;
  fecha: string | null;
  notas: string;
}) {
  const pro = await requireProfessional();

  if (!Number.isFinite(entrada.importeEuros)) throw new ActionInputError("Importe no válido.");
  if (Math.abs(entrada.importeEuros) > 21_474_836.47) {
    throw new ActionInputError("El importe excede el máximo admitido.");
  }
  if (entrada.periodo && !PERIODOS.includes(entrada.periodo)) {
    throw new ActionInputError("Periodo no válido.");
  }

  const fila = {
    professional_id: pro.id,
    ejercicio: entrada.ejercicio,
    clase: entrada.clase,
    periodo: entrada.periodo || null,
    modelo: entrada.modelo.trim() || null,
    importe_cents: eurosACentimos(entrada.importeEuros),
    fecha: entrada.fecha || null,
    notas: entrada.notas.trim() || null,
  };

  const supabase = await createClient();
  const { error } = entrada.id
    ? await supabase
        .from("retenciones_pagos_cuenta")
        .update(fila)
        .eq("id", entrada.id)
        .eq("professional_id", pro.id)
    : await supabase.from("retenciones_pagos_cuenta").insert(fila);
  if (error) throw new Error(error.message);
  revalidar(entrada.ejercicio);
}

async function borrarRetencionActionImpl(id: string, ejercicio: number) {
  const pro = await requireProfessional();
  const supabase = await createClient();
  const { error } = await supabase
    .from("retenciones_pagos_cuenta")
    .delete()
    .eq("id", id)
    .eq("professional_id", pro.id);
  if (error) {
    if (error.code === "23503") {
      throw new ActionInputError(
        "No se puede borrar: hay una rectificación que apunta a este registro.",
      );
    }
    throw new Error(error.message);
  }
  revalidar(ejercicio);
}

/**
 * Checklist de documentación personal para el gestor.
 *
 * `aplica` admite `null` de forma explícita: sin responder no es "no aplica".
 * Un expediente no debe presentarse como completo porque nadie haya contestado.
 */
async function guardarChecklistActionImpl(entrada: {
  ejercicio: number;
  clave: string;
  aplica: boolean | null;
  aportado: boolean;
  notas: string;
}) {
  const pro = await requireProfessional();
  if (!entrada.clave.trim()) throw new ActionInputError("Elemento no válido.");

  const supabase = await createClient();
  const { error } = await supabase.from("checklist_personal").upsert(
    {
      professional_id: pro.id,
      ejercicio: entrada.ejercicio,
      clave: entrada.clave,
      aplica: entrada.aplica,
      aportado: entrada.aportado,
      notas: entrada.notas.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "professional_id,ejercicio,clave" },
  );
  if (error) throw new Error(error.message);
  revalidar(entrada.ejercicio);
}

export async function guardarRetencionAction(...args: Parameters<typeof guardarRetencionActionImpl>) { return runAction(() => guardarRetencionActionImpl(...args)); }
export async function borrarRetencionAction(...args: Parameters<typeof borrarRetencionActionImpl>) { return runAction(() => borrarRetencionActionImpl(...args)); }
export async function guardarChecklistAction(...args: Parameters<typeof guardarChecklistActionImpl>) { return runAction(() => guardarChecklistActionImpl(...args)); }
