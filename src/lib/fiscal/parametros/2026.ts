/**
 * Parámetros fiscales del ejercicio 2026. AISLADOS por año: no hardcodees
 * porcentajes dispersos por el código; añádelos aquí y versiónalos por ejercicio.
 * Todo cálculo es ORIENTATIVO.
 *
 * Los parámetros que no están confirmados contra la AEAT se declaran como
 * `{ valor, verificado: false, fuente }` en vez de como un número suelto. Así
 * el motor puede propagar "esto es una estimación no verificada" hasta el
 * dashboard y hasta el XLSX, en lugar de presentar una cifra concreta con la
 * misma apariencia de certeza que las demás.
 */

/** Un parámetro que puede estar pendiente de confirmar contra la AEAT. */
export type ParamVerificable = {
  valor: number;
  verificado: boolean;
  /** Etiqueta legible para el aviso al usuario. */
  fuente?: string;
};

export const PARAMS_2026 = {
  ejercicio: 2026,

  // ESTABLES (verificados a ene-2026):
  irpfPagoFraccionado: 0.2, // modelo 130: 20% del rendimiento neto
  retencionGeneral: 0.15,
  retencionReducidaNuevos: 0.07, // año de alta + 2 siguientes
  ivaExencionArticulo: "20.Uno.3º LIVA",

  // ⚠️ PENDIENTES DE CONFIRMAR CONTRA LA AEAT 2026:
  gastosDificilJustificacionPct: {
    valor: 0.05,
    verificado: false,
    fuente: "5 % general; fue 7 % excepcional en 2023 — confirmar para 2026",
  } as ParamVerificable,
  gastosDificilJustificacionTope: {
    valor: 2000,
    verificado: false,
    fuente: "Tope anual en € — confirmar para 2026",
  } as ParamVerificable,

  // Tramos RETA 2026 (cuota mensual por ingresos reales). Vacío a propósito:
  // las tablas no estaban publicadas a ene-2026.
  reta: {
    verificado: false,
    fuente: "Tablas RETA 2026 pendientes de publicación",
    tramos: [] as Array<{
      ingresosMin: number;
      ingresosMax: number;
      cuotaMensual: number;
    }>,
  },

  fechasPresentacion: {
    // MM-DD del fin de plazo de cada trimestre (Q4 se presenta en enero del año siguiente)
    modelo130: { Q1: "04-20", Q2: "07-20", Q3: "10-20", Q4: "01-30" },
    renta: { inicio: "04-02", fin: "06-30" },
  },
} as const;

export type ParamsFiscales = typeof PARAMS_2026;

/** Nombres legibles de los parámetros del ejercicio que aún no están verificados. */
export function parametrosNoVerificados(params: ParamsFiscales): string[] {
  const out: string[] = [];
  if (!params.gastosDificilJustificacionPct.verificado) {
    out.push("% de gastos de difícil justificación");
  }
  if (!params.gastosDificilJustificacionTope.verificado) {
    out.push("tope anual de gastos de difícil justificación");
  }
  return out;
}
