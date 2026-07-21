/**
 * Utilidades puras del motor fiscal (sin acceso a BD ni al reloj).
 * Trabajan en euros (number) y redondean a céntimos.
 */
import type {
  BienInversionFiscal,
  ConfigFiscal,
  GastoFiscal,
  SituacionIva,
  Trimestre,
} from "./types";
import type { ParamsFiscales } from "./parametros";

/** Redondeo a 2 decimales (céntimos), evitando arrastre de coma flotante. */
export function redondear(euros: number): number {
  return Math.round((euros + Number.EPSILON) * 100) / 100;
}

/** Trimestre natural (1–4) de una fecha ISO/YYYY-MM-DD. */
export function trimestreDeFecha(fecha: string): Trimestre {
  const mes = Number(fecha.slice(5, 7)); // 01–12
  return (Math.floor((mes - 1) / 3) + 1) as Trimestre;
}

/** Año (YYYY) de una fecha ISO/YYYY-MM-DD. */
export function anioDeFecha(fecha: string): number {
  return Number(fecha.slice(0, 4));
}

/**
 * Gasto deducible en IRPF de un gasto corriente, aplicando el % de afectación.
 * Si la actividad está EXENTA de IVA (psicólogos, art. 20.Uno.3º), el IVA
 * soportado no se deduce vía modelo 303 y pasa a ser mayor coste deducible en
 * IRPF; si está SUJETA, el IVA se deduce aparte y no entra en el coste IRPF.
 * Regla orientativa.
 */
export function deducibleIrpf(
  gasto: Pick<GastoFiscal, "base" | "cuotaIva" | "porcentajeAfectacion">,
  situacionIva: SituacionIva,
): number {
  const costeAfectable =
    situacionIva === "sujeta" ? gasto.base : gasto.base + gasto.cuotaIva;
  return redondear((costeAfectable * gasto.porcentajeAfectacion) / 100);
}

/** Amortización anual de un bien de inversión (valor × % coeficiente). */
export function amortizacionAnual(bien: BienInversionFiscal): number {
  return redondear((bien.valorAdquisicion * bien.porcentajeAmortizacion) / 100);
}

/**
 * Tipo de retención aplicable a los ingresos con retención: reducida (7%)
 * durante el año de alta y los 2 siguientes; general (15%) después.
 */
export function tasaRetencion(
  config: Pick<ConfigFiscal, "fechaAltaActividad">,
  ejercicio: number,
  params: ParamsFiscales,
): number {
  if (!config.fechaAltaActividad) return params.retencionGeneral;
  const altaYear = anioDeFecha(config.fechaAltaActividad);
  return ejercicio <= altaYear + 2
    ? params.retencionReducidaNuevos
    : params.retencionGeneral;
}
