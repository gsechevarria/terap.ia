import { allRows, checked } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";
import type { Tables } from "@/lib/types";
import { obtenerReglas, type Territorio } from "@/lib/fiscal/reglas";
import {
  evaluarObligaciones,
  type DatosObligaciones,
  type Obligacion,
} from "@/lib/fiscal/obligaciones";
import { sumar, type Centimos } from "@/lib/fiscal/dinero";

export type Expediente = Tables<"expedientes_fiscales">;
export type Factura = Tables<"facturas">;
export type Retencion = Tables<"retenciones_pagos_cuenta">;

/** Pasos del asistente. El orden importa: es el recorrido. */
export const PASOS = [
  { clave: "perfil", titulo: "Perfil fiscal" },
  { clave: "ingresos", titulo: "Ingresos" },
  { clave: "gastos", titulo: "Gastos" },
  { clave: "bienes", titulo: "Bienes y amortizaciones" },
  { clave: "retenciones", titulo: "Retenciones y pagos a cuenta" },
  { clave: "personal", titulo: "Documentación personal" },
  { clave: "revision", titulo: "Revisión y exportación" },
] as const;

export type PasoClave = (typeof PASOS)[number]["clave"];

export function esPasoValido(valor: string | undefined): valor is PasoClave {
  return PASOS.some((p) => p.clave === valor);
}

/**
 * Estado de cada paso: si está cubierto y qué falta.
 *
 * `completo` NO significa correcto, significa que hay datos suficientes para
 * seguir. Lo que falta se enumera, porque un porcentaje de avance sin decir de
 * qué se compone no ayuda a nadie a terminar.
 */
export type EstadoPaso = {
  clave: PasoClave;
  titulo: string;
  completo: boolean;
  faltan: string[];
  /** Cuántos registros hay, para dar contexto sin abrir el paso. */
  registros?: number;
};

export type ResumenExpediente = {
  expediente: Expediente | null;
  ejercicio: number;
  pasos: EstadoPaso[];
  obligaciones: Obligacion[];
  reglasSoportadas: boolean;
  territorioAsumido: boolean;
  totales: {
    ingresosConfirmadosCents: Centimos;
    ingresosPendientes: number;
    gastosConfirmadosCents: Centimos;
    gastosPendientes: number;
    retencionesSoportadasCents: Centimos;
    pagosFraccionadosCents: Centimos;
  };
};

/** Ejercicios con datos, más el año en curso, para el selector. */
export async function getEjerciciosDisponibles(): Promise<number[]> {
  const ahora = new Date().getFullYear();
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [ahora];

  const { data } = await allRows(supabase
    .from("expedientes_fiscales")
    .select("ejercicio")
    .eq("professional_id", pro.id));

  const años = new Set<number>([ahora, ahora - 1]);
  for (const fila of data ?? []) años.add(fila.ejercicio);
  return [...años].sort((a, b) => b - a);
}

export async function getExpediente(ejercicio: number): Promise<Expediente | null> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return null;
  const { data } = await checked(supabase
    .from("expedientes_fiscales")
    .select("*")
    .eq("professional_id", pro.id)
    .eq("ejercicio", ejercicio)
    .maybeSingle());
  return data ?? null;
}

export async function getFacturas(ejercicio: number): Promise<Factura[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];
  const { data } = await allRows(supabase
    .from("facturas")
    .select("*")
    .eq("professional_id", pro.id)
    .eq("ejercicio_imputacion", ejercicio)
    .order("fecha_emision", { ascending: false }));
  return data ?? [];
}

export async function getRetenciones(ejercicio: number): Promise<Retencion[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];
  const { data } = await allRows(supabase
    .from("retenciones_pagos_cuenta")
    .select("*")
    .eq("professional_id", pro.id)
    .eq("ejercicio", ejercicio)
    .order("fecha", { ascending: false, nullsFirst: false }));
  return data ?? [];
}

export async function getChecklistPersonal(
  ejercicio: number,
): Promise<Tables<"checklist_personal">[]> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return [];
  const { data } = await allRows(supabase
    .from("checklist_personal")
    .select("*")
    .eq("professional_id", pro.id)
    .eq("ejercicio", ejercicio));
  return data ?? [];
}

/**
 * Reúne el estado completo del expediente de un ejercicio.
 *
 * Todo en paralelo: en secuencia serían siete viajes encadenados para pintar
 * una sola pantalla.
 */
export async function getResumenExpediente(
  ejercicio: number,
): Promise<ResumenExpediente> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();

  const vacio: ResumenExpediente = {
    expediente: null,
    ejercicio,
    pasos: PASOS.map((p) => ({ ...p, completo: false, faltan: ["Sin sesión"] })),
    obligaciones: [],
    reglasSoportadas: false,
    territorioAsumido: true,
    totales: {
      ingresosConfirmadosCents: 0,
      ingresosPendientes: 0,
      gastosConfirmadosCents: 0,
      gastosPendientes: 0,
      retencionesSoportadasCents: 0,
      pagosFraccionadosCents: 0,
    },
  };
  if (!pro) return vacio;

  const desde = `${ejercicio}-01-01`;
  const hasta = `${ejercicio + 1}-01-01`;

  const [cfgRes, expRes, facturasRes, cobrosRes, gastosRes, bienesRes, retRes, checkRes] =
    await Promise.all([
      checked(supabase.from("configuracion_fiscal").select("*").eq("professional_id", pro.id).maybeSingle()),
      checked(supabase.from("expedientes_fiscales").select("*").eq("professional_id", pro.id).eq("ejercicio", ejercicio).maybeSingle()),
      allRows(supabase.from("facturas").select("id, estado, total_cents, tratamiento_iva, retencion_cents").eq("professional_id", pro.id).eq("ejercicio_imputacion", ejercicio)),
      allRows(supabase.from("v_ingresos_fiscales").select("id, base_cents, fiscal_review_required").eq("professional_id", pro.id).gte("fecha", desde).lt("fecha", hasta)),
      allRows(supabase.from("gastos").select("id, total_cents, iva_recuperable_pct").eq("professional_id", pro.id).gte("fecha", desde).lt("fecha", hasta)),
      allRows(supabase.from("bienes_inversion").select("id, fiscal_review_required").eq("professional_id", pro.id)),
      allRows(supabase.from("retenciones_pagos_cuenta").select("id, clase, importe_cents").eq("professional_id", pro.id).eq("ejercicio", ejercicio)),
      allRows(supabase.from("checklist_personal").select("id, aplica, aportado").eq("professional_id", pro.id).eq("ejercicio", ejercicio)),
    ]);

  const cfg = cfgRes.data;
  const facturas = facturasRes.data ?? [];
  const cobros = cobrosRes.data ?? [];
  const gastos = gastosRes.data ?? [];
  const bienes = bienesRes.data ?? [];
  const retenciones = retRes.data ?? [];
  const checklist = checkRes.data ?? [];

  const territorio = (cfg?.territorio ?? null) as Territorio | null;
  const reglas = obtenerReglas(ejercicio, territorio, cfg?.territorio_confirmado ?? false);

  const cobrosConfirmados = cobros.filter((c) => !c.fiscal_review_required);
  const gastosConfirmados = gastos.filter((g) => g.iva_recuperable_pct != null);

  const datosObligaciones: DatosObligaciones = {
    ejercicio,
    territorio,
    regimen: (cfg?.regimen as DatosObligaciones["regimen"]) ?? null,
    anioAltaActividad: cfg?.fecha_alta_actividad
      ? Number(cfg.fecha_alta_actividad.slice(0, 4))
      : null,
    // El ejercicio anterior no se deduce de aquí: se pregunta en el paso de
    // retenciones. Sin ese dato la obligación queda pendiente, que es lo
    // correcto y no "no obligado".
    ingresosAnioAnteriorCents: null,
    ingresosConRetencionAnioAnteriorCents: null,
    situacionIva: (cfg?.situacion_iva as DatosObligaciones["situacionIva"]) ?? null,
    tieneEmpleados: cfg?.tiene_empleados ?? null,
    tieneColaboradoresConRetencion: cfg?.tiene_colaboradores ?? null,
    tieneAlquileresConRetencion: cfg?.tiene_alquileres ?? null,
  };

  const faltaPerfil: string[] = [];
  if (!cfg) faltaPerfil.push("Configuración fiscal sin crear");
  else {
    if (!cfg.territorio_confirmado) faltaPerfil.push("Confirmar el territorio fiscal");
    if (!cfg.criterio_imputacion || cfg.criterio_imputacion === "desconocido") {
      faltaPerfil.push("Criterio de imputación temporal");
    }
    if (cfg.tiene_empleados === null) faltaPerfil.push("¿Hay empleados?");
    if (cfg.tiene_colaboradores === null) faltaPerfil.push("¿Hay colaboradores?");
    if (cfg.tiene_alquileres === null) faltaPerfil.push("¿Hay alquileres?");
  }

  const pasos: EstadoPaso[] = [
    {
      clave: "perfil",
      titulo: "Perfil fiscal",
      completo: faltaPerfil.length === 0,
      faltan: faltaPerfil,
    },
    {
      clave: "ingresos",
      titulo: "Ingresos",
      registros: facturas.length + cobros.length,
      completo: cobros.length > 0 || facturas.length > 0,
      faltan:
        cobros.length - cobrosConfirmados.length > 0
          ? [`${cobros.length - cobrosConfirmados.length} cobros sin tratamiento fiscal`]
          : facturas.length + cobros.length === 0
            ? ["No hay ingresos registrados en el ejercicio"]
            : [],
    },
    {
      clave: "gastos",
      titulo: "Gastos",
      registros: gastos.length,
      completo: gastos.length > 0 && gastosConfirmados.length === gastos.length,
      faltan:
        gastos.length - gastosConfirmados.length > 0
          ? [`${gastos.length - gastosConfirmados.length} gastos sin IVA recuperable`]
          : gastos.length === 0
            ? ["No hay gastos registrados"]
            : [],
    },
    {
      clave: "bienes",
      titulo: "Bienes y amortizaciones",
      registros: bienes.length,
      completo: bienes.every((b) => !b.fiscal_review_required),
      faltan: bienes.some((b) => b.fiscal_review_required)
        ? [`${bienes.filter((b) => b.fiscal_review_required).length} bienes pendientes de revisar`]
        : [],
    },
    {
      clave: "retenciones",
      titulo: "Retenciones y pagos a cuenta",
      registros: retenciones.length,
      completo: retenciones.length > 0,
      faltan: retenciones.length === 0 ? ["Sin retenciones ni pagos registrados"] : [],
    },
    {
      clave: "personal",
      titulo: "Documentación personal",
      registros: checklist.length,
      // Opcional a propósito: es documentación de la renta personal, no de la
      // actividad. No bloquea el expediente.
      completo: checklist.some((c) => c.aplica !== null),
      faltan: checklist.every((c) => c.aplica === null)
        ? ["Sin responder (opcional)"]
        : [],
    },
    {
      clave: "revision",
      titulo: "Revisión y exportación",
      completo: expRes.data?.estado === "revisado",
      faltan: expRes.data?.estado === "revisado" ? [] : ["Sin marcar como revisado"],
    },
  ];

  return {
    expediente: expRes.data ?? null,
    ejercicio,
    pasos,
    obligaciones: evaluarObligaciones(datosObligaciones),
    reglasSoportadas: reglas.soportado,
    territorioAsumido: reglas.territorioAsumido,
    totales: {
      ingresosConfirmadosCents: sumar(...cobrosConfirmados.map((c) => c.base_cents ?? 0)),
      ingresosPendientes: cobros.length - cobrosConfirmados.length,
      gastosConfirmadosCents: sumar(...gastosConfirmados.map((g) => g.total_cents)),
      gastosPendientes: gastos.length - gastosConfirmados.length,
      retencionesSoportadasCents: sumar(
        ...retenciones.filter((r) => r.clase === "soportada_cliente").map((r) => r.importe_cents),
      ),
      pagosFraccionadosCents: sumar(
        ...retenciones.filter((r) => r.clase === "pago_fraccionado_irpf").map((r) => r.importe_cents),
      ),
    },
  };
}
