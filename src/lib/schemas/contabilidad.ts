import { z } from "zod";
import { CATEGORIAS_GASTO } from "@/lib/fiscal";
import { UUID, YMD, importeEuros, porcentaje, textoOpcional } from "./common";

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.undefined()])
  .transform((v) => v != null);

/**
 * Alta / edición de un gasto.
 *
 * `porcentaje_afectacion` es el caso que más dolía: se leía con
 * `clampPct(num(fd, ...) || 100)`, y `num` devuelve 0 tanto para "0" como para
 * un valor no numérico, así que el `|| 100` convertía el 0 explícito en 100 %.
 * El profesional que marcaba un gasto como NO afecto a la actividad se lo
 * deducía entero. Aquí el campo tiene default 100 solo cuando falta de verdad.
 */
export const gastoBaseSchema = z.object({
  fecha: YMD,
  categoria_deducible: z.enum(CATEGORIAS_GASTO, {
    message: "Categoría no válida.",
  }),
  proveedor_nombre: textoOpcional.optional().default(null),
  proveedor_nif: textoOpcional.optional().default(null),
  concepto: textoOpcional.optional().default(null),
  base: importeEuros,
  tipo_iva: porcentaje.optional().default(21),
  porcentaje_afectacion: porcentaje.optional().default(100),
  es_bien_inversion: checkbox.optional().default(false),
  porcentaje_amortizacion: porcentaje.optional().default(0),
  anios_amortizacion: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional()
    .transform((s) => (s == null ? null : Number(s)))
    .refine(
      (n) => n == null || (Number.isInteger(n) && n > 0 && n <= 50),
      "Los años de amortización deben ser un número entre 1 y 50.",
    ),
});

export const createGastoSchema = gastoBaseSchema;
export const updateGastoSchema = gastoBaseSchema.extend({ id: UUID });

export const configuracionFiscalSchema = z.object({
  regimen: z
    .enum(["estimacion_directa_simplificada", "estimacion_directa_normal"])
    .catch("estimacion_directa_simplificada"),
  situacion_iva: z.enum(["exenta", "sujeta", "mixta"]).catch("exenta"),
  epigrafe_iae: textoOpcional.optional().default(null),
  fecha_alta_actividad: YMD.nullable().optional().default(null),
  aplica_retencion_default: checkbox.optional().default(false),
  tipo_iva_repercutido: porcentaje.optional().default(21),
  // Solo obligatoria en régimen mixto; se valida abajo.
  prorrata_iva_pct: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional()
    .transform((s) => (s == null ? null : Number(s.replace(",", "."))))
    .refine(
      (n) => n == null || (Number.isFinite(n) && n >= 0 && n <= 100),
      "La prorrata debe estar entre 0 y 100.",
    )
    .transform((n) => (n == null ? null : Math.round(n))),
});

export const configuracionFiscalRefined = configuracionFiscalSchema.refine(
  (v) => v.situacion_iva !== "mixta" || v.prorrata_iva_pct != null,
  {
    path: ["prorrata_iva_pct"],
    message:
      "En régimen mixto hay que indicar la prorrata de IVA: sin ella no se puede calcular qué parte del IVA soportado es gasto deducible.",
  },
);
