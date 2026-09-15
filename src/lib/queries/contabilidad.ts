import { checked, allRows } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";
import type {
  BienInversion,
  ConfiguracionFiscal,
  Gasto,
  IngresoFiscalRow,
} from "@/lib/types";
import {
  CONFIG_FISCAL_DEFAULT,
  type BienInversionFiscal,
  type CategoriaGasto,
  type ConfigFiscal,
  type FiscalArrays,
  type GastoFiscal,
  type IngresoFiscal,
  type Regimen,
  type SituacionIva,
} from "@/lib/fiscal";

const c2e = (cents: number | null | undefined) => (cents ?? 0) / 100;

// --- Mappers DB (céntimos) → dominio fiscal (euros) -------------------------
function toConfigDomain(row: ConfiguracionFiscal | null): ConfigFiscal {
  if (!row) return CONFIG_FISCAL_DEFAULT;
  return {
    regimen: row.regimen as Regimen,
    situacionIva: row.situacion_iva as SituacionIva,
    epigrafeIae: row.epigrafe_iae,
    fechaAltaActividad: row.fecha_alta_actividad,
    aplicaRetencionDefault: row.aplica_retencion_default,
    tipoIvaRepercutido: row.tipo_iva_repercutido ?? 21,
    prorrataIvaPct: row.prorrata_iva_pct,
  };
}

function toIngresoFiscal(row: IngresoFiscalRow): IngresoFiscal | null {
  if (!row.id || !row.fecha) throw new Error("Ingreso incompleto.");
  if (row.fiscal_review_required || row.base_cents == null || row.cuota_iva_cents == null) {
    // Ya no hay control en la interfaz para confirmarlos uno a uno: se retiró
    // de la tabla de pagos. Los cobros nuevos capturan su tratamiento solos a
    // partir de la configuración fiscal (disparador `payments_capture_fiscal`);
    // los anteriores a esa configuración se regularizan con el script de
    // mantenimiento. Si el mensaje aparece con cobros recientes, es que la
    // configuración declara actividad mixta o retención por defecto, casos que
    // el disparador no resuelve solo.
    throw new Error("Hay cobros sin tratamiento fiscal confirmado. Los cobros nuevos lo capturan a partir de su configuración fiscal; los anteriores a ella se regularizan siguiendo docs/DIAGNOSTICO-HISTORICOS.md.");
  }
  return {
    id: row.id,
    fecha: row.fecha,
    total: c2e(row.total_cents),
    base: c2e(row.base_cents),
    cuotaIva: c2e(row.cuota_iva_cents),
    tipoOperacion: row.tipo_operacion === "sujeta" ? "sujeta" : "exenta",
    retencionAplicable: !!row.retencion_aplicable,
    retencion: c2e(row.retencion_cents),
    nombrePagador: row.nombre_pagador,
  };
}

function toGastoFiscal(g: Gasto): GastoFiscal {
  if (g.iva_recuperable_pct == null) throw new Error("Revisa el IVA recuperable de los gastos históricos antes de calcular o exportar.");
  return {
    id: g.id,
    fecha: g.fecha,
    categoria: g.categoria_deducible as CategoriaGasto,
    proveedorNombre: g.proveedor_nombre,
    proveedorNif: g.proveedor_nif,
    concepto: g.concepto,
    base: c2e(g.base_cents),
    tipoIva: g.tipo_iva,
    cuotaIva: c2e(g.cuota_iva_cents),
    total: c2e(g.total_cents),
    porcentajeAfectacion: g.porcentaje_afectacion,
    esBienInversion: g.es_bien_inversion,
    ivaRecuperablePct: g.iva_recuperable_pct,
  };
}

function toBienFiscal(b: BienInversion): BienInversionFiscal {
  if (b.fiscal_review_required) throw new Error("Revisa el gasto de origen de los bienes históricos antes de calcular o exportar.");
  return {
    id: b.id,
    descripcion: b.descripcion,
    fechaAdquisicion: b.fecha_adquisicion,
    valorAdquisicion: c2e(b.valor_adquisicion_cents),
    porcentajeAmortizacion: b.porcentaje_amortizacion,
    aniosAmortizacion: b.anios_amortizacion,
  };
}

// --- Lecturas crudas (para la UI de gestión) --------------------------------
export async function getConfiguracionFiscal(): Promise<ConfiguracionFiscal | null> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return null;
  const { data } = await checked(supabase
    .from("configuracion_fiscal")
    .select("*")
    .eq("professional_id", pro.id)
    .maybeSingle());
  return data ?? null;
}

export async function getGastos(): Promise<Gasto[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];
  const { data } = await allRows(supabase
    .from("gastos")
    .select("*")
    .eq("professional_id", pro.id)
    .order("fecha", { ascending: false }));
  return data ?? [];
}

export async function getBienesInversion(): Promise<BienInversion[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];
  const { data } = await allRows(supabase
    .from("bienes_inversion")
    .select("*")
    .eq("professional_id", pro.id)
    .order("fecha_adquisicion", { ascending: false }));
  return data ?? [];
}

/**
 * Qué impide calcular el resumen, con nombre y recuento.
 *
 * Existe porque el módulo se niega a calcular con históricos sin confirmar y
 * hasta ahora eso se traducía en una pantalla de error que mandaba al
 * profesional a buscar registros por su cuenta, sin decirle cuántos eran ni
 * dónde estaban.
 */
export type PendienteRevision = {
  cobros: { id: string; fecha: string; importeCents: number; paciente: string | null }[];
  gastos: { id: string; fecha: string; concepto: string | null; totalCents: number }[];
  bienes: { id: string; descripcion: string | null; gastoId: string | null }[];
};

export async function getPendientesRevisionFiscal(): Promise<PendienteRevision> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return { cobros: [], gastos: [], bienes: [] };

  const [cobrosRes, gastosRes, bienesRes] = await Promise.all([
    allRows(supabase
      .from("v_ingresos_fiscales")
      .select("id, fecha, total_cents, nombre_pagador")
      .eq("professional_id", pro.id)
      .eq("fiscal_review_required", true)
      .order("fecha", { ascending: false })),
    allRows(supabase
      .from("gastos")
      .select("id, fecha, concepto, total_cents")
      .eq("professional_id", pro.id)
      .is("iva_recuperable_pct", null)
      .order("fecha", { ascending: false })),
    allRows(supabase
      .from("bienes_inversion")
      .select("id, descripcion, gasto_id")
      .eq("professional_id", pro.id)
      .eq("fiscal_review_required", true)),
  ]);

  return {
    cobros: (cobrosRes.data ?? []).map((c) => ({
      id: c.id ?? "",
      fecha: c.fecha ?? "",
      importeCents: c.total_cents ?? 0,
      paciente: c.nombre_pagador,
    })),
    gastos: (gastosRes.data ?? []).map((g) => ({
      id: g.id,
      fecha: g.fecha,
      concepto: g.concepto,
      totalCents: g.total_cents,
    })),
    bienes: (bienesRes.data ?? []).map((b) => ({
      id: b.id,
      descripcion: b.descripcion,
      gastoId: b.gasto_id,
    })),
  };
}

// --- Datos del ejercicio para el motor fiscal (euros) -----------------------
/**
 * Reúne configuración + ingresos (vista) + gastos + bienes de un ejercicio,
 * mapeados a euros, listos para el motor `lib/fiscal`. La RLS de la vista
 * (security_invoker) garantiza que solo llegan los ingresos del profesional.
 */
export async function getFiscalArrays(ejercicio: number): Promise<FiscalArrays> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) {
    return { config: CONFIG_FISCAL_DEFAULT, ingresos: [], gastos: [], bienes: [] };
  }
  const from = `${ejercicio}-01-01`;
  const to = `${ejercicio + 1}-01-01`;

  const [cfgRes, ingRes, gasRes, bienRes] = await Promise.all([
    checked(supabase
      .from("configuracion_fiscal")
      .select("*")
      .eq("professional_id", pro.id)
      .maybeSingle()),
    allRows(supabase
      .from("v_ingresos_fiscales")
      .select("*")
      .eq("professional_id", pro.id)
      .gte("fecha", from)
      .lt("fecha", to)),
    allRows(supabase
      .from("gastos")
      .select("*")
      .eq("professional_id", pro.id)
      .gte("fecha", from)
      .lt("fecha", to)),
    allRows(supabase.from("bienes_inversion").select("*").eq("professional_id", pro.id)),
  ]);

  return {
    config: toConfigDomain(cfgRes.data ?? null),
    ingresos: (ingRes.data ?? [])
      .map(toIngresoFiscal)
      .filter((x): x is IngresoFiscal => x != null),
    gastos: (gasRes.data ?? []).map(toGastoFiscal),
    bienes: (bienRes.data ?? []).map(toBienFiscal),
  };
}
