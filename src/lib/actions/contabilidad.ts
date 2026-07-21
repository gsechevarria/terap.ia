"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";
import { CATEGORIAS_GASTO, type CategoriaGasto } from "@/lib/fiscal";
import type { Database } from "@/lib/database.types";

type GastoUpdate = Database["public"]["Tables"]["gastos"]["Update"];

const RECEIPTS_BUCKET = "receipts";
const eurosToCents = (euros: number) => Math.round((Number(euros) || 0) * 100);
const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function num(fd: FormData, key: string): number {
  return Number(str(fd, key).replace(",", ".")) || 0;
}
function bool(fd: FormData, key: string): boolean {
  const v = str(fd, key);
  return v === "on" || v === "true" || v === "1";
}
function isCategoria(v: string): v is CategoriaGasto {
  return (CATEGORIAS_GASTO as readonly string[]).includes(v);
}

// --- Configuración fiscal ---------------------------------------------------
export async function upsertConfiguracionFiscalAction(fd: FormData) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");

  const regimen = str(fd, "regimen");
  const situacion_iva = str(fd, "situacion_iva");
  const epigrafe_iae = str(fd, "epigrafe_iae") || null;
  const fecha_alta_actividad = str(fd, "fecha_alta_actividad") || null;
  const aplica_retencion_default = bool(fd, "aplica_retencion_default");

  const regimenOk =
    regimen === "estimacion_directa_simplificada" ||
    regimen === "estimacion_directa_normal"
      ? regimen
      : "estimacion_directa_simplificada";
  const ivaOk =
    situacion_iva === "exenta" ||
    situacion_iva === "sujeta" ||
    situacion_iva === "mixta"
      ? situacion_iva
      : "exenta";

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion_fiscal").upsert(
    {
      professional_id: pro.id,
      regimen: regimenOk,
      situacion_iva: ivaOk,
      epigrafe_iae,
      fecha_alta_actividad,
      aplica_retencion_default,
    },
    { onConflict: "professional_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/contabilidad/configuracion");
  revalidatePath("/contabilidad");
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
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");

  const categoria = str(fd, "categoria_deducible");
  if (!isCategoria(categoria)) throw new Error("Categoría no válida.");
  const fecha = str(fd, "fecha");
  if (!fecha) throw new Error("La fecha es obligatoria.");

  const baseCents = eurosToCents(num(fd, "base"));
  const tipoIva = clampPct(num(fd, "tipo_iva"));
  const cuotaIvaCents = Math.round((baseCents * tipoIva) / 100);
  const totalCents = baseCents + cuotaIvaCents;
  const afectacion = clampPct(num(fd, "porcentaje_afectacion") || 100);
  const esBien = bool(fd, "es_bien_inversion");

  const supabase = await createClient();
  const adjunto_path = await uploadReceipt(pro.id, fd.get("adjunto") as File | null);

  const { data: gasto, error } = await supabase
    .from("gastos")
    .insert({
      professional_id: pro.id,
      fecha,
      proveedor_nombre: str(fd, "proveedor_nombre") || null,
      proveedor_nif: str(fd, "proveedor_nif") || null,
      categoria_deducible: categoria,
      concepto: str(fd, "concepto") || null,
      base_cents: baseCents,
      tipo_iva: tipoIva,
      cuota_iva_cents: cuotaIvaCents,
      total_cents: totalCents,
      porcentaje_afectacion: afectacion,
      es_bien_inversion: esBien,
      adjunto_path,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Si es bien de inversión, crea también la ficha de amortización.
  if (esBien && gasto) {
    const pctAmort = clampPct(num(fd, "porcentaje_amortizacion"));
    const aniosRaw = Math.round(num(fd, "anios_amortizacion"));
    const { error: bErr } = await supabase.from("bienes_inversion").insert({
      professional_id: pro.id,
      gasto_id: gasto.id,
      descripcion: str(fd, "concepto") || str(fd, "proveedor_nombre") || "Bien de inversión",
      fecha_adquisicion: fecha,
      valor_adquisicion_cents: baseCents,
      porcentaje_amortizacion: pctAmort,
      anios_amortizacion: aniosRaw > 0 ? aniosRaw : null,
    });
    if (bErr) throw new Error(bErr.message);
  }

  revalidatePath("/contabilidad/gastos");
  revalidatePath("/contabilidad");
}

export async function updateGastoAction(fd: FormData) {
  const pro = await getCurrentProfessional();
  if (!pro) throw new Error("No autenticado.");
  const id = str(fd, "id");
  if (!id) throw new Error("Falta el gasto.");

  const categoria = str(fd, "categoria_deducible");
  if (!isCategoria(categoria)) throw new Error("Categoría no válida.");
  const fecha = str(fd, "fecha");
  if (!fecha) throw new Error("La fecha es obligatoria.");

  const baseCents = eurosToCents(num(fd, "base"));
  const tipoIva = clampPct(num(fd, "tipo_iva"));
  const cuotaIvaCents = Math.round((baseCents * tipoIva) / 100);
  const totalCents = baseCents + cuotaIvaCents;
  const afectacion = clampPct(num(fd, "porcentaje_afectacion") || 100);

  const supabase = await createClient();
  const patch: GastoUpdate = {
    fecha,
    proveedor_nombre: str(fd, "proveedor_nombre") || null,
    proveedor_nif: str(fd, "proveedor_nif") || null,
    categoria_deducible: categoria,
    concepto: str(fd, "concepto") || null,
    base_cents: baseCents,
    tipo_iva: tipoIva,
    cuota_iva_cents: cuotaIvaCents,
    total_cents: totalCents,
    porcentaje_afectacion: afectacion,
  };

  // Reemplazo opcional del justificante.
  const nuevo = fd.get("adjunto") as File | null;
  if (nuevo && nuevo.size > 0) {
    const { data: prev } = await supabase
      .from("gastos")
      .select("adjunto_path")
      .eq("id", id)
      .maybeSingle();
    patch.adjunto_path = await uploadReceipt(pro.id, nuevo);
    if (prev?.adjunto_path) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([prev.adjunto_path]);
    }
  }

  const { error } = await supabase.from("gastos").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contabilidad/gastos");
  revalidatePath("/contabilidad");
}

export async function deleteGastoAction(id: string) {
  const supabase = await createClient();
  const { data: gasto } = await supabase
    .from("gastos")
    .select("adjunto_path")
    .eq("id", id)
    .maybeSingle();
  if (gasto?.adjunto_path) {
    await supabase.storage.from(RECEIPTS_BUCKET).remove([gasto.adjunto_path]);
  }
  // El bien de inversión vinculado se queda con gasto_id = null (on delete set null).
  await supabase.from("bienes_inversion").delete().eq("gasto_id", id);
  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contabilidad/gastos");
  revalidatePath("/contabilidad");
}
