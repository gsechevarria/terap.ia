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
  };
}

function toIngresoFiscal(row: IngresoFiscalRow): IngresoFiscal | null {
  if (!row.id || !row.fecha) return null;
  return {
    id: row.id,
    fecha: row.fecha,
    total: c2e(row.total_cents),
    base: c2e(row.base_cents),
    cuotaIva: c2e(row.cuota_iva_cents),
    tipoOperacion: row.tipo_operacion === "sujeta" ? "sujeta" : "exenta",
    retencionAplicable: !!row.retencion_aplicable,
    nombrePagador: row.nombre_pagador,
  };
}

function toGastoFiscal(g: Gasto): GastoFiscal {
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
  };
}

function toBienFiscal(b: BienInversion): BienInversionFiscal {
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
  const { data } = await supabase
    .from("configuracion_fiscal")
    .select("*")
    .eq("professional_id", pro.id)
    .maybeSingle();
  return data ?? null;
}

export async function getGastos(): Promise<Gasto[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];
  const { data } = await supabase
    .from("gastos")
    .select("*")
    .eq("professional_id", pro.id)
    .order("fecha", { ascending: false });
  return data ?? [];
}

export async function getBienesInversion(): Promise<BienInversion[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];
  const { data } = await supabase
    .from("bienes_inversion")
    .select("*")
    .eq("professional_id", pro.id)
    .order("fecha_adquisicion", { ascending: false });
  return data ?? [];
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
    supabase
      .from("configuracion_fiscal")
      .select("*")
      .eq("professional_id", pro.id)
      .maybeSingle(),
    supabase
      .from("v_ingresos_fiscales")
      .select("*")
      .eq("professional_id", pro.id)
      .gte("fecha", from)
      .lt("fecha", to),
    supabase
      .from("gastos")
      .select("*")
      .eq("professional_id", pro.id)
      .gte("fecha", from)
      .lt("fecha", to),
    supabase.from("bienes_inversion").select("*").eq("professional_id", pro.id),
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
