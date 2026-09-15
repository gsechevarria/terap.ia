"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfessional } from "@/lib/queries/identity";
import type { Enums } from "@/lib/database.types";

const EJERCICIO_MIN = 2015;
const EJERCICIO_MAX = 2100;

function validarEjercicio(ejercicio: number): void {
  if (!Number.isInteger(ejercicio) || ejercicio < EJERCICIO_MIN || ejercicio > EJERCICIO_MAX) {
    throw new ActionInputError("Ejercicio no válido.");
  }
}

function revalidarExpediente(ejercicio: number): void {
  revalidatePath(`/pro/contabilidad/expediente/${ejercicio}`);
  revalidatePath("/pro/contabilidad");
}

/**
 * Abre el expediente del ejercicio si no existía.
 *
 * Idempotente: el índice único `(professional_id, ejercicio)` impide el
 * duplicado, y `onConflict` lo convierte en un no-op en vez de un error que el
 * profesional tendría que entender. Dos pestañas abiertas no rompen nada.
 */
async function abrirExpedienteActionImpl(ejercicio: number) {
  const pro = await requireProfessional();
  validarEjercicio(ejercicio);

  const supabase = await createClient();
  const { error } = await supabase
    .from("expedientes_fiscales")
    .upsert(
      { professional_id: pro.id, ejercicio },
      { onConflict: "professional_id,ejercicio", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  revalidarExpediente(ejercicio);
}

/**
 * Cambia el estado del expediente.
 *
 * `revisado` exige nombre de quien revisa, y el disparador de la base lo
 * comprueba otra vez: la constancia de una revisión no puede depender de que
 * el formulario del cliente haya hecho su trabajo. Volver a borrador la borra,
 * porque conservarla sugeriría que el expediente sigue revisado.
 */
async function cambiarEstadoExpedienteActionImpl(
  ejercicio: number,
  estado: Enums<"estado_expediente">,
  revisadoPor?: string,
) {
  const pro = await requireProfessional();
  validarEjercicio(ejercicio);

  const estados: Enums<"estado_expediente">[] = [
    "borrador",
    "pendiente_informacion",
    "preparado_revision",
    "revisado",
  ];
  if (!estados.includes(estado)) throw new ActionInputError("Estado no válido.");

  const nombre = revisadoPor?.trim() ?? "";
  if (estado === "revisado" && nombre.length === 0) {
    throw new ActionInputError("Indique quién revisa el expediente.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("expedientes_fiscales")
    .update({
      estado,
      revisado_por: estado === "revisado" ? nombre : null,
    })
    .eq("professional_id", pro.id)
    .eq("ejercicio", ejercicio);
  if (error) throw new Error(error.message);
  revalidarExpediente(ejercicio);
}

/** Nota para la gestoría: dudas y ajustes manuales que viajan con el ZIP. */
async function guardarNotaGestorActionImpl(ejercicio: number, nota: string) {
  const pro = await requireProfessional();
  validarEjercicio(ejercicio);
  if (nota.length > 5000) throw new ActionInputError("La nota es demasiado larga.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("expedientes_fiscales")
    .update({ nota_gestor: nota.trim() || null })
    .eq("professional_id", pro.id)
    .eq("ejercicio", ejercicio);
  if (error) throw new Error(error.message);
  revalidarExpediente(ejercicio);
}

/**
 * Completa el perfil fiscal con lo que el asistente pregunta y la tabla
 * original no tenía.
 *
 * Los tres booleanos admiten `null` de forma explícita: "no lo sé" no es "no".
 * Un `false` por omisión determinaría obligaciones formales —el 111 y el 115—
 * sobre una pregunta que nadie ha contestado.
 */
async function guardarPerfilFiscalActionImpl(entrada: {
  territorio: Enums<"territorio_fiscal">;
  territorioConfirmado: boolean;
  comunidadAutonoma: string | null;
  criterioImputacion: Enums<"criterio_imputacion">;
  fechaBajaActividad: string | null;
  tieneEmpleados: boolean | null;
  tieneColaboradores: boolean | null;
  tieneAlquileres: boolean | null;
  operacionesInternacionales: boolean | null;
  tipoConsulta: string | null;
}) {
  const pro = await requireProfessional();
  const supabase = await createClient();

  const { error } = await supabase
    .from("configuracion_fiscal")
    .update({
      territorio: entrada.territorio,
      territorio_confirmado: entrada.territorioConfirmado,
      comunidad_autonoma: entrada.comunidadAutonoma?.trim() || null,
      criterio_imputacion: entrada.criterioImputacion,
      fecha_baja_actividad: entrada.fechaBajaActividad || null,
      tiene_empleados: entrada.tieneEmpleados,
      tiene_colaboradores: entrada.tieneColaboradores,
      tiene_alquileres: entrada.tieneAlquileres,
      operaciones_internacionales: entrada.operacionesInternacionales,
      tipo_consulta: entrada.tipoConsulta?.trim() || null,
    })
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);

  revalidatePath("/pro/contabilidad", "layout");
}

export async function abrirExpedienteAction(...args: Parameters<typeof abrirExpedienteActionImpl>) { return runAction(() => abrirExpedienteActionImpl(...args)); }
export async function cambiarEstadoExpedienteAction(...args: Parameters<typeof cambiarEstadoExpedienteActionImpl>) { return runAction(() => cambiarEstadoExpedienteActionImpl(...args)); }
export async function guardarNotaGestorAction(...args: Parameters<typeof guardarNotaGestorActionImpl>) { return runAction(() => guardarNotaGestorActionImpl(...args)); }
export async function guardarPerfilFiscalAction(...args: Parameters<typeof guardarPerfilFiscalActionImpl>) { return runAction(() => guardarPerfilFiscalActionImpl(...args)); }
