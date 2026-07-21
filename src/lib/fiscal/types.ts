/**
 * Tipos del dominio fiscal (motor ORIENTATIVO). Todo importe aquí está en
 * EUROS (number); la conversión desde céntimos vive en la capa de queries.
 * Nada de esto emite facturas ni constituye asesoramiento fiscal.
 */

export type Regimen =
  | "estimacion_directa_simplificada"
  | "estimacion_directa_normal";

export type SituacionIva = "exenta" | "sujeta" | "mixta";

export type Trimestre = 1 | 2 | 3 | 4;

export const CATEGORIAS_GASTO = [
  "cuota_colegial",
  "seguro_rc",
  "formacion",
  "alquiler_consulta",
  "suministros",
  "software",
  "material",
  "gestoria",
  "desplazamiento",
  "otros",
] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export const CATEGORIA_LABEL: Record<CategoriaGasto, string> = {
  cuota_colegial: "Cuota colegial",
  seguro_rc: "Seguro de responsabilidad civil",
  formacion: "Formación",
  alquiler_consulta: "Alquiler de consulta",
  suministros: "Suministros",
  software: "Software",
  material: "Material",
  gestoria: "Gestoría",
  desplazamiento: "Desplazamiento",
  otros: "Otros",
};

export const REGIMEN_LABEL: Record<Regimen, string> = {
  estimacion_directa_simplificada: "Estimación directa simplificada",
  estimacion_directa_normal: "Estimación directa normal",
};

export const SITUACION_IVA_LABEL: Record<SituacionIva, string> = {
  exenta: "Exenta (art. 20.Uno.3º LIVA)",
  sujeta: "Sujeta",
  mixta: "Mixta",
};

/** Descargo obligatorio en todo output fiscal. */
export const DESCARGO_FISCAL =
  "Estimación orientativa. No sustituye a tu asesor fiscal ni constituye asesoramiento fiscal.";

// --- Configuración del profesional (dominio) --------------------------------
export interface ConfigFiscal {
  regimen: Regimen;
  situacionIva: SituacionIva;
  epigrafeIae: string | null;
  fechaAltaActividad: string | null; // YYYY-MM-DD
  aplicaRetencionDefault: boolean;
}

export const CONFIG_FISCAL_DEFAULT: ConfigFiscal = {
  regimen: "estimacion_directa_simplificada",
  situacionIva: "exenta",
  epigrafeIae: "776",
  fechaAltaActividad: null,
  aplicaRetencionDefault: false,
};

// --- Movimientos (dominio, en euros) ----------------------------------------
export interface IngresoFiscal {
  id: string;
  fecha: string; // ISO
  total: number;
  base: number;
  cuotaIva: number;
  tipoOperacion: "exenta" | "sujeta";
  retencionAplicable: boolean;
  nombrePagador: string | null;
}

export interface GastoFiscal {
  id: string;
  fecha: string; // YYYY-MM-DD
  categoria: CategoriaGasto;
  proveedorNombre: string | null;
  proveedorNif: string | null;
  concepto: string | null;
  base: number;
  tipoIva: number; // %
  cuotaIva: number;
  total: number;
  porcentajeAfectacion: number; // %
  esBienInversion: boolean;
}

export interface BienInversionFiscal {
  id: string;
  descripcion: string;
  fechaAdquisicion: string; // YYYY-MM-DD
  valorAdquisicion: number;
  porcentajeAmortizacion: number; // %
  aniosAmortizacion: number | null;
}

/** Conjunto de datos fiscales de un ejercicio, listo para el motor. */
export interface FiscalArrays {
  config: ConfigFiscal;
  ingresos: IngresoFiscal[];
  gastos: GastoFiscal[];
  bienes: BienInversionFiscal[];
}

// --- Resultados del motor ---------------------------------------------------
export interface Modelo130Result {
  trimestre: Trimestre;
  ingresosAcumulados: number;
  gastosDeduciblesAcumulados: number;
  rendimientoNeto: number;
  gastosDificilJustificacion: number;
  baseLiquidacion: number;
  tipoAplicado: number; // p.ej. 0.20
  cuota: number;
  retencionesAcumuladas: number;
  pagosFraccionadosPrevios: number;
  pagoTrimestre: number;
}

export interface GastosPorCategoria {
  categoria: CategoriaGasto;
  base: number;
  cuotaIva: number;
  total: number;
  deducible: number;
}

export interface ResumenAnual {
  ejercicio: number;
  ingresosTotales: number;
  gastosDeduciblesTotales: number; // gastos corrientes + amortizaciones
  gastosCorrientes: number;
  amortizacionesTotales: number;
  gastosDificilJustificacion: number;
  rendimientoNeto: number;
  retencionesSoportadas: number;
  pagosFraccionados: number; // suma de los 4 modelo 130
  gastosPorCategoria: GastosPorCategoria[];
  trimestres: Modelo130Result[];
}
