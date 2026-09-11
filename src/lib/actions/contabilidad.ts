"use server";
import { runAction } from "@/lib/action-server";

import { requireUploadedFile } from "@/lib/upload-server";
import { revalidateContabilidad } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { requireProfessional } from "@/lib/queries/identity";
import { formToObject, parseOrThrow } from "@/lib/schemas/common";
import {
  configuracionFiscalRefined,
  createGastoSchema,
  updateGastoSchema,
} from "@/lib/schemas/contabilidad";
import type { Json } from "@/lib/database.types";

const RECEIPTS_BUCKET = "receipts";
const eurosToCents = (euros: number) => Math.round(euros * 100);

// --- Configuración fiscal ---------------------------------------------------
async function upsertConfiguracionFiscalActionImpl(fd: FormData) {
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
async function saveGasto(fd: FormData, updating: boolean) {
  const pro = await requireProfessional();
  const v = updating ? parseOrThrow(updateGastoSchema, formToObject(fd)) : parseOrThrow(createGastoSchema, formToObject(fd));
  const supabase = await createClient();
  const pathInput = String(fd.get("adjunto_path") ?? "");
  const path = pathInput ? await requireUploadedFile(pathInput, "receipts", pro.id) : null;
  try {
    const payload: Record<string, Json | undefined> = {
      ...v, base_cents: eurosToCents(v.base), adjunto_path: path,
    };
    // undefined significa conservar los campos de inversión en una edición parcial.
    const { error } = await supabase.rpc("save_expense", {
      p_id: updating ? String(fd.get("id")) : null,
      p_data: payload, p_replace_receipt: path !== null,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    if (path) {
      const cleanup = await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
      if (cleanup.error) console.error("[storage] limpieza pendiente de justificante");
    }
    throw error;
  }
  revalidateContabilidad();
}
async function createGastoActionImpl(fd: FormData) { return saveGasto(fd, false); }
async function updateGastoActionImpl(fd: FormData) { return saveGasto(fd, true); }
async function deleteGastoActionImpl(id: string) {
  await requireProfessional();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_expense", { p_id: id });
  if (error) throw new Error(error.message);
  // El trigger transaccional encola la limpieza del justificante.
  revalidateContabilidad();
}

export async function upsertConfiguracionFiscalAction(...args: Parameters<typeof upsertConfiguracionFiscalActionImpl>) { return runAction(() => upsertConfiguracionFiscalActionImpl(...args)); }

export async function createGastoAction(...args: Parameters<typeof createGastoActionImpl>) { return runAction(() => createGastoActionImpl(...args)); }

export async function updateGastoAction(...args: Parameters<typeof updateGastoActionImpl>) { return runAction(() => updateGastoActionImpl(...args)); }

export async function deleteGastoAction(...args: Parameters<typeof deleteGastoActionImpl>) { return runAction(() => deleteGastoActionImpl(...args)); }
