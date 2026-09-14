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

  // COMPROBADOS CONTRA LA AEAT (14-sep-2026) PERO NO VERIFICADOS AQUÍ.
  //
  // La sede de la AEAT (Estimación directa simplificada) dice literalmente:
  // «5% en general y 10% en 2026 para Ceuta s/diferencia positiva (Máximo 2.000
  // euros)», y anota «En 2023 fue el 7%».
  // https://sede.agenciatributaria.gob.es/Sede/irpf/empresarios-individuales-profesionales/regimenes-determinar-rendimiento-actividad/estimacion-directa-simplificada.html
  //
  // Los dos valores de abajo son, por tanto, correctos para el CASO GENERAL. Se
  // dejan como no verificados a propósito por dos motivos, y basta con uno:
  //
  //  1. El motor aplica un porcentaje plano y NO modela el 10 % de Ceuta de
  //     2026. Para un profesional en Ceuta la cifra sería baja (conservadora,
  //     pero baja). Modelarlo exige un campo nuevo en `configuracion_fiscal`.
  //  2. Poner `verificado: true` apaga el aviso de «estimación no verificada»
  //     en el panel y la fila de advertencia dentro del XLSX. Quién asume esa
  //     certeza sobre cifras fiscales es una decisión de la persona
  //     responsable, no del código.
  //
  // Para darlos por verificados basta cambiar los dos `false` a `true`.
  gastosDificilJustificacionPct: {
    valor: 0.05,
    verificado: false,
    fuente:
      "5 % general (AEAT, comprobado 14-sep-2026). No se modela el 10 % de Ceuta de 2026",
  } as ParamVerificable,
  gastosDificilJustificacionTope: {
    valor: 2000,
    verificado: false,
    fuente: "Tope anual de 2.000 € (AEAT, comprobado 14-sep-2026)",
  } as ParamVerificable,

  // Tramos RETA 2026 (cuota mensual por ingresos reales). Sigue vacío, pero ya
  // NO porque falte publicarlos: las tablas de 2026 están en la Orden
  // PJC/297/2026 (BOE de 31-mar-2026). Está vacío porque **ningún código lee
  // este campo**: no hay ninguna funcionalidad que estime la cuota de autónomos.
  // Rellenarlo antes de que exista esa funcionalidad sería meter una tabla
  // fiscal que nadie usa y que envejece sola. Cuando haga falta, los importes se
  // copian del BOE, no de resúmenes de terceros.
  reta: {
    verificado: false,
    fuente:
      "Orden PJC/297/2026 (BOE 31-mar-2026). Sin rellenar: ningún cálculo usa este campo",
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
