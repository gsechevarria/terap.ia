"use server";

import { revalidateContabilidad } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { requireProfessional } from "@/lib/queries/identity";
import { formToObject, parseOrThrow } from "@/lib/schemas/common";
import {
  configuracionFiscalRefined,
  createGastoSchema,
  updateGastoSchema,
} from "@/lib/schemas/contabilidad";
import type { Database } from "@/lib/database.types";

type GastoUpdate = Database["public"]["Tables"]["gastos"]["Update"];

const RECEIPTS_BUCKET = "receipts";
const eurosToCents = (euros: number) => Math.round(euros * 100);

// --- Configuración fiscal ---------------------------------------------------
export async function upsertConfiguracionFiscalAction(fd: FormData) {
  const pro = await requireProfessional();
  const v = parseOrThrow(configuracionFiscalRefined, formToObject(fd));

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion_fiscal").upsert(
    {
      professional_id: pro.id,
      regimen: v.regimen,
      situacion_iva: v.situacion_iva,
      epigrafe_iae: v.epigrafe_iae,
      fecha_alta_actividad: v.fecha_alta_actividad,
      aplica_retencion_default: v.aplica_retencion_default,
      tipo_iva_repercutido: v.tipo_iva_repercutido,
      // En exenta y sujeta la prorrata se deriva del régimen (0 y 100): solo se
      // persiste el valor declarado cuando es mixta.
      prorrata_iva_pct:
        v.situacion_iva === "mixta" ? v.prorrata_iva_pct : null,
    },
    { onConflict: "professional_id" },
  );
  if (error) throw new Error(error.message);
  revalidateContabilidad();
}

// --- Gastos -----------------------------------------------------------------
function receiptPath(proId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${proId}/${crypto.randomUUID()}-${safe}`;
}

async function uploadReceipt(
  proId: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = await createClient();
  const path = receiptPath(proId, file.name);
  const up = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (up.error) throw new Error(up.error.message);
  return path;
}

export async function createGastoAction(fd: FormData) {
  const pro = await requireProfessional();
  const v = parseOrThrow(createGastoSchema, formToObject(fd));

  const baseCents = eurosToCents(v.base);
  const cuotaIvaCents = Math.round((baseCents * v.tipo_iva) / 100);
  const totalCents = baseCents + cuotaIvaCents;

  const supabase = await createClient();
  const adjunto_path = await uploadReceipt(pro.id, fd.get("adjunto") as File | null);

  const { data: gasto, error } = await supabase
    .from("gastos")
    .insert({
      professional_id: pro.id,
      fecha: v.fecha,
      proveedor_nombre: v.proveedor_nombre,
      proveedor_nif: v.proveedor_nif,
      categoria_deducible: v.categoria_deducible,
      concepto: v.concepto,
      base_cents: baseCents,
      tipo_iva: v.tipo_iva,
      cuota_iva_cents: cuotaIvaCents,
      total_cents: totalCents,
      porcentaje_afectacion: v.porcentaje_afectacion,
      es_bien_inversion: v.es_bien_inversion,
      adjunto_path,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (v.es_bien_inversion) {
    const { error: bErr } = await supabase.from("bienes_inversion").insert({
      professional_id: pro.id,
      gasto_id: gasto.id,
      descripcion: v.concepto || v.proveedor_nombre || "Bien de inversión",
      fecha_adquisicion: v.fecha,
      valor_adquisicion_cents: baseCents,
      porcentaje_amortizacion: v.porcentaje_amortizacion,
      anios_amortizacion: v.anios_amortizacion,
    });
    if (bErr) throw new Error(bErr.message);
  }

  revalidateContabilidad();
}

/**
 * Edita un gasto y PROPAGA el cambio a su ficha de amortización.
 *
 * Antes solo se tocaba `gastos`: corregir un portátil de 3.000 € a 1.200 €
 * dejaba `valor_adquisicion_cents` en 300000, es decir 450 €/año de gasto
 * inexistente durante toda la vida útil. También se contemplan las dos
 * transiciones: dejar de ser bien de inversión (se borra la ficha) y pasar a
 * serlo (se crea).
 */
export async function updateGastoAction(fd: FormData) {
  const pro = await requireProfessional();
  const v = parseOrThrow(updateGastoSchema, formToObject(fd));

  const baseCents = eurosToCents(v.base);
  const cuotaIvaCents = Math.round((baseCents * v.tipo_iva) / 100);
  const totalCents = baseCents + cuotaIvaCents;

  const supabase = await createClient();
  const patch: GastoUpdate = {
    fecha: v.fecha,
    proveedor_nombre: v.proveedor_nombre,
    proveedor_nif: v.proveedor_nif,
    categoria_deducible: v.categoria_deducible,
    concepto: v.concepto,
    base_cents: baseCents,
    tipo_iva: v.tipo_iva,
    cuota_iva_cents: cuotaIvaCents,
    total_cents: totalCents,
    porcentaje_afectacion: v.porcentaje_afectacion,
    es_bien_inversion: v.es_bien_inversion,
  };

  // Reemplazo opcional del justificante.
  const nuevo = fd.get("adjunto") as File | null;
  if (nuevo && nuevo.size > 0) {
    const { data: prev } = await supabase
      .from("gastos")
      .select("adjunto_path")
      .eq("id", v.id)
      .eq("professional_id", pro.id)
      .maybeSingle();
    patch.adjunto_path = await uploadReceipt(pro.id, nuevo);
    if (prev?.adjunto_path) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([prev.adjunto_path]);
    }
  }

  // `.select().single()` en vez de ignorar el resultado: en PostgREST un UPDATE
  // que no casa ninguna fila devuelve `error: null`, así que la UI cerraba el
  // editor y enseñaba los datos viejos como si se hubieran guardado.
  const { data: updated, error } = await supabase
    .from("gastos")
    .update(patch)
    .eq("id", v.id)
    .eq("professional_id", pro.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Gasto no encontrado.");

  const { data: bien } = await supabase
    .from("bienes_inversion")
    .select("id")
    .eq("gasto_id", v.id)
    .eq("professional_id", pro.id)
    .maybeSingle();

  if (v.es_bien_inversion) {
    const ficha = {
      professional_id: pro.id,
      gasto_id: v.id,
      descripcion: v.concepto || v.proveedor_nombre || "Bien de inversión",
      fecha_adquisicion: v.fecha,
      valor_adquisicion_cents: baseCents,
      porcentaje_amortizacion: v.porcentaje_amortizacion,
      anios_amortizacion: v.anios_amortizacion,
    };
    const { error: bErr } = bien
      ? await supabase.from("bienes_inversion").update(ficha).eq("id", bien.id)
      : await supabase.from("bienes_inversion").insert(ficha);
    if (bErr) throw new Error(bErr.message);
  } else if (bien) {
    // Ha dejado de ser bien de inversión: fuera la ficha de amortización.
    const { error: dErr } = await supabase
      .from("bienes_inversion")
      .delete()
      .eq("id", bien.id);
    if (dErr) throw new Error(dErr.message);
  }

  revalidateContabilidad();
}

/**
 * Borra un gasto.
 *
 * ORDEN IMPORTANTE: primero el gasto. Antes se borraban la ficha de
 * amortización y el justificante de Storage ANTES de comprobar que el borrado
 * del gasto salía bien, así que si la RLS lo rechazaba se perdían las dos cosas
 * y el gasto seguía ahí.
 */
export async function deleteGastoAction(id: string) {
  const pro = await requireProfessional();

  const supabase = await createClient();
  const { data: gasto } = await supabase
    .from("gastos")
    .select("adjunto_path")
    .eq("id", id)
    .eq("professional_id", pro.id)
    .maybeSingle();
  if (!gasto) throw new Error("Gasto no encontrado.");

  // El id de la ficha se captura AHORA: `bienes_inversion.gasto_id` es
  // `on delete set null`, así que en cuanto se borre el gasto ya no se podría
  // localizar por esa columna.
  const { data: bien } = await supabase
    .from("bienes_inversion")
    .select("id")
    .eq("gasto_id", id)
    .eq("professional_id", pro.id)
    .maybeSingle();

  // 1) Primero el gasto: si la RLS lo rechaza, no se ha perdido nada.
  const { data: deleted, error } = await supabase
    .from("gastos")
    .delete()
    .eq("id", id)
    .eq("professional_id", pro.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!deleted) throw new Error("No se ha podido borrar el gasto.");

  // 2) Ya con el gasto fuera, la ficha de amortización y el justificante.
  if (bien) {
    await supabase.from("bienes_inversion").delete().eq("id", bien.id);
  }
  if (gasto.adjunto_path) {
    await supabase.storage.from(RECEIPTS_BUCKET).remove([gasto.adjunto_path]);
  }

  revalidateContabilidad();
}
