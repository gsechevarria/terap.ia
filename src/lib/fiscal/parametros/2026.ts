/**
 * Parámetros fiscales del ejercicio 2026. AISLADOS por año: no hardcodees
 * porcentajes dispersos por el código; añádelos aquí y versiónalos por ejercicio.
 * Los valores marcados TODO_VERIFICAR deben confirmarse contra la AEAT antes de
 * darlos por buenos. Todo cálculo es ORIENTATIVO.
 */
export const PARAMS_2026 = {
  ejercicio: 2026,

  // ESTABLES (verificados a ene-2026):
  irpfPagoFraccionado: 0.2, // modelo 130: 20% del rendimiento neto
  retencionGeneral: 0.15,
  retencionReducidaNuevos: 0.07, // año de alta + 2 siguientes
  ivaExencionArticulo: "20.Uno.3º LIVA",

  // ⚠️ CONFIRMAR CONTRA AEAT 2026 antes de dar por buenas las cifras:
  gastosDificilJustificacionPct: 0.05, // TODO_VERIFICAR: 5% general; fue 7% excepcional en 2023
  gastosDificilJustificacionTope: 2000, // TODO_VERIFICAR: tope anual en €
  // Tramos RETA 2026 (cuota mensual por ingresos reales) — TODO_VERIFICAR: tablas pendientes a ene-2026
  retaTramos: [] as Array<{
    ingresosMin: number;
    ingresosMax: number;
    cuotaMensual: number;
  }>,

  fechasPresentacion: {
    // MM-DD del fin de plazo de cada trimestre (Q4 se presenta en enero del año siguiente)
    modelo130: { Q1: "04-20", Q2: "07-20", Q3: "10-20", Q4: "01-30" },
    renta: { inicio: "04-02", fin: "06-30" },
  },
} as const;

export type ParamsFiscales = typeof PARAMS_2026;
