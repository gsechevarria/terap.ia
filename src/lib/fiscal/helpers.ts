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
 *
 * - EXENTA (psicólogos, art. 20.Uno.3º): el IVA soportado no se recupera vía
 *   modelo 303, así que es mayor coste deducible en IRPF.
 * - SUJETA: el IVA se deduce aparte y no entra en el coste de IRPF.
 * - MIXTA: solo la parte de IVA que NO se recupera es coste. Antes, la
 *   condición era `situacionIva === "sujeta" ? base : base + cuotaIva`, de modo
 *   que "mixta" caía en la rama de "exenta" y sumaba el IVA entero: la porción
 *   recuperada por el 303 se restaba dos veces.
 *
 * `prorrataIva` es el % de IVA soportado recuperable (0 en exenta, 100 en
 * sujeta). En régimen mixto es obligatorio: si no se conoce, esta función
 * lanza en vez de asumir el escenario más favorable al contribuyente.
 *
 * Regla orientativa.
 */
export function deducibleIrpf(
  gasto: Pick<GastoFiscal, "base" | "cuotaIva" | "porcentajeAfectacion">,
  situacionIva: SituacionIva,
  prorrataIva?: number | null,
): number {
  let costeAfectable: number;

  if (situacionIva === "sujeta") {
    costeAfectable = gasto.base;
  } else if (situacionIva === "exenta") {
    costeAfectable = gasto.base + gasto.cuotaIva;
  } else {
    if (prorrataIva == null || !Number.isFinite(prorrataIva)) {
      throw new Error(
        "Actividad en régimen mixto sin prorrata de IVA configurada: no se puede calcular el gasto deducible. Indícala en Contabilidad → Configuración.",
      );
    }
    const pct = Math.min(100, Math.max(0, prorrataIva));
    const ivaNoRecuperable = gasto.cuotaIva * (1 - pct / 100);
    costeAfectable = gasto.base + ivaNoRecuperable;
  }

  return redondear((costeAfectable * gasto.porcentajeAfectacion) / 100);
}

/** Amortización anual TEÓRICA de un bien (valor × % coeficiente), año completo. */
export function amortizacionAnual(bien: BienInversionFiscal): number {
  return redondear((bien.valorAdquisicion * bien.porcentajeAmortizacion) / 100);
}

/**
 * Amortización imputable a un ejercicio, PRORRATEADA por días desde la fecha de
 * adquisición.
 *
 * Antes se imputaba el año completo desde el mes de compra: un ordenador de
 * 3.000 € al 25 % comprado el 15-nov-2026 se deducía 750 € en 2026, cuando solo
 * corresponden ~96 €. Y al repartirlo por trimestres se imputaban 187,50 € al
 * 1T, por un bien que todavía no existía.
 */
export function amortizacionEjercicio(
  bien: BienInversionFiscal,
  ejercicio: number,
): number {
  const anual = (bien.valorAdquisicion * bien.porcentajeAmortizacion) / 100;
  const adqYear = anioDeFecha(bien.fechaAdquisicion);

  if (adqYear > ejercicio) return 0;
  // Fuera de la vida útil declarada.
  if (
    bien.aniosAmortizacion != null &&
    ejercicio > adqYear + bien.aniosAmortizacion - 1
  ) {
    return 0;
  }
  if (adqYear < ejercicio) return redondear(anual);

  const adq = new Date(`${bien.fechaAdquisicion.slice(0, 10)}T00:00:00Z`);
  const finAnio = Date.UTC(ejercicio, 11, 31);
  const dias = Math.floor((finAnio - adq.getTime()) / 86_400_000) + 1;
  return redondear((anual * Math.max(0, dias)) / 365);
}

/** Trimestre (1-4) en el que se adquirió un bien, o null si es de otro año. */
export function trimestreAdquisicion(
  bien: BienInversionFiscal,
  ejercicio: number,
): Trimestre | null {
  const adqYear = anioDeFecha(bien.fechaAdquisicion);
  if (adqYear > ejercicio) return null;
  if (adqYear < ejercicio) return 1; // ya estaba vivo desde el 1T
  return trimestreDeFecha(bien.fechaAdquisicion);
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
