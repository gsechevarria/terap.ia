"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfessional } from "@/lib/queries/identity";
import { aplicarPorcentaje, sumar } from "@/lib/fiscal/dinero";
import type { Enums } from "@/lib/database.types";

const eurosACentimos = (euros: number) => Math.round(euros * 100);

function revalidar(ejercicio: number): void {
  revalidatePath(`/pro/contabilidad/expediente/${ejercicio}`);
  revalidatePath("/pro/contabilidad");
}

export type EntradaFactura = {
  id?: string;
  serie: string;
  numero: string;
  tipo: Enums<"tipo_factura">;
  rectificaA: string | null;
  fechaEmision: string;
  fechaOperacion: string | null;
  ejercicioImputacion: number;
  destinatarioNombre: string;
  destinatarioNif: string;
  destinatarioTipo: Enums<"tipo_destinatario"> | null;
  categoriaServicio: Enums<"categoria_servicio"> | null;
  baseEuros: number;
  tratamientoIva: Enums<"tratamiento_iva">;
  tipoIva: number | null;
  retencionPct: number | null;
  notas: string;
};

/**
 * Alta o edición de una factura del libro registro.
 *
 * ANOTAR NO ES EMITIR. La aplicación no genera ningún documento de factura: solo
 * registra las emitidas fuera, que es lo que la AEAT exige conservar y lo que
 * mantiene el producto fuera del alcance de Verifactu.
 *
 * La cuota y la retención se CALCULAN aquí desde la base y los porcentajes, en
 * céntimos enteros. Pedirlas por separado invita a que no cuadren, y una
 * factura cuyo total no es base más cuota es un error que nadie detecta hasta
 * que el gestor suma la columna.
 */
async function guardarFacturaActionImpl(entrada: EntradaFactura) {
  const pro = await requireProfessional();

  if (!entrada.fechaEmision) throw new ActionInputError("Indique la fecha de emisión.");
  if (!Number.isFinite(entrada.baseEuros)) throw new ActionInputError("Base no válida.");
  if (Math.abs(entrada.baseEuros) > 21_474_836.47) {
    throw new ActionInputError("La base excede el máximo admitido.");
  }
  if (entrada.tipo === "rectificativa" && !entrada.rectificaA) {
    throw new ActionInputError("Una factura rectificativa debe indicar a cuál rectifica.");
  }

  const sujeta = entrada.tratamientoIva === "sujeta";
  const tipoIva = sujeta ? (entrada.tipoIva ?? 0) : 0;
  if (tipoIva < 0 || tipoIva > 100) throw new ActionInputError("Tipo de IVA no válido.");

  const retencionPct = entrada.retencionPct ?? 0;
  if (retencionPct < 0 || retencionPct > 100) {
    throw new ActionInputError("Porcentaje de retención no válido.");
  }

  const baseCents = eurosACentimos(entrada.baseEuros);
  const cuotaCents = sujeta ? aplicarPorcentaje(baseCents, tipoIva) : 0;
  const retencionCents = aplicarPorcentaje(baseCents, retencionPct);
  // La retención NO resta de los ingresos de la actividad: es un pago a cuenta
  // del IRPF del profesional. El total es lo facturado; lo cobrado, menos.
  const totalCents = sumar(baseCents, cuotaCents);

  const fila = {
    professional_id: pro.id,
    serie: entrada.serie.trim() || null,
    numero: entrada.numero.trim() || null,
    tipo: entrada.tipo,
    rectifica_a: entrada.rectificaA,
    fecha_emision: entrada.fechaEmision,
    fecha_operacion: entrada.fechaOperacion || null,
    ejercicio_imputacion: entrada.ejercicioImputacion,
    destinatario_nombre: entrada.destinatarioNombre.trim() || null,
    destinatario_nif: entrada.destinatarioNif.trim() || null,
    destinatario_tipo: entrada.destinatarioTipo,
    categoria_servicio: entrada.categoriaServicio,
    base_cents: baseCents,
    tratamiento_iva: entrada.tratamientoIva,
    tipo_iva: sujeta ? tipoIva : null,
    cuota_iva_cents: cuotaCents,
    retencion_pct: retencionPct || null,
    retencion_cents: retencionCents,
    total_cents: totalCents,
    notas: entrada.notas.trim() || null,
    origen: "manual",
  };

  const supabase = await createClient();
  const { error } = entrada.id
    ? await supabase.from("facturas").update(fila).eq("id", entrada.id).eq("professional_id", pro.id)
    : await supabase.from("facturas").insert(fila);

  if (error) {
    // El índice único de serie y número existe para que dos facturas no
    // compartan numeración, que en un libro registro es un defecto formal.
    if (error.code === "23505") {
      throw new ActionInputError("Ya existe una factura con esa serie y número.");
    }
    throw new Error(error.message);
  }
  revalidar(entrada.ejercicioImputacion);
}

/** Confirma, aparta o excluye una factura del expediente. */
async function cambiarEstadoFacturaActionImpl(
  facturaId: string,
  ejercicio: number,
  estado: Enums<"estado_registro_fiscal">,
  motivo?: string,
) {
  const pro = await requireProfessional();
  if (estado === "excluido" && !motivo?.trim()) {
    throw new ActionInputError("Indique por qué se excluye del expediente.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("facturas")
    .update({ estado, motivo_exclusion: estado === "excluido" ? motivo!.trim() : null })
    .eq("id", facturaId)
    .eq("professional_id", pro.id);
  if (error) throw new Error(error.message);
  revalidar(ejercicio);
}

async function borrarFacturaActionImpl(facturaId: string, ejercicio: number) {
  const pro = await requireProfessional();
  const supabase = await createClient();
  const { error } = await supabase
    .from("facturas")
    .delete()
    .eq("id", facturaId)
    .eq("professional_id", pro.id);
  if (error) {
    // `on delete restrict` en `rectifica_a`: borrar la original dejaría a su
    // rectificativa apuntando al vacío, y una rectificativa huérfana no se
    // puede interpretar.
    if (error.code === "23503") {
      throw new ActionInputError(
        "No se puede borrar: hay una factura rectificativa que apunta a esta.",
      );
    }
    throw new Error(error.message);
  }
  revalidar(ejercicio);
}

/** Imputa un cobro a una factura, sin duplicar el importe. */
async function registrarCobroFacturaActionImpl(
  facturaId: string,
  ejercicio: number,
  fecha: string,
  importeEuros: number,
) {
  await requireProfessional();
  if (!fecha) throw new ActionInputError("Indique la fecha del cobro.");
  if (!Number.isFinite(importeEuros) || importeEuros === 0) {
    throw new ActionInputError("El importe del cobro no puede ser cero.");
  }
  const supabase = await createClient();
  // La RLS de `factura_cobros` comprueba que la factura sea del profesional
  // actual, así que un id ajeno no pasa aunque se conozca.
  const { error } = await supabase.from("factura_cobros").insert({
    factura_id: facturaId,
    fecha,
    importe_cents: eurosACentimos(importeEuros),
  });
  if (error) throw new Error(error.message);
  revalidar(ejercicio);
}

export async function guardarFacturaAction(...args: Parameters<typeof guardarFacturaActionImpl>) { return runAction(() => guardarFacturaActionImpl(...args)); }
export async function cambiarEstadoFacturaAction(...args: Parameters<typeof cambiarEstadoFacturaActionImpl>) { return runAction(() => cambiarEstadoFacturaActionImpl(...args)); }
export async function borrarFacturaAction(...args: Parameters<typeof borrarFacturaActionImpl>) { return runAction(() => borrarFacturaActionImpl(...args)); }
export async function registrarCobroFacturaAction(...args: Parameters<typeof registrarCobroFacturaActionImpl>) { return runAction(() => registrarCobroFacturaActionImpl(...args)); }
