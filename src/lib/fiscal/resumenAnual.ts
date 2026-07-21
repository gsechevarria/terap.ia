/**
 * Agregados del ejercicio para la Renta + los 4 pagos fraccionados (modelo 130).
 * ORIENTATIVO. Toma las arrays del dominio (euros) y los parámetros del año.
 */
import type {
  CategoriaGasto,
  FiscalArrays,
  GastosPorCategoria,
  Modelo130Result,
  ResumenAnual,
  Trimestre,
} from "./types";
import { CATEGORIAS_GASTO } from "./types";
import type { ParamsFiscales } from "./parametros";
import {
  amortizacionAnual,
  anioDeFecha,
  deducibleIrpf,
  redondear,
  tasaRetencion,
  trimestreDeFecha,
} from "./helpers";
import { calcularModelo130 } from "./modelo130";

export function calcularResumenAnual(
  data: FiscalArrays,
  ejercicio: number,
  params: ParamsFiscales,
): ResumenAnual {
  const { config } = data;
  const ingresos = data.ingresos.filter((i) => anioDeFecha(i.fecha) === ejercicio);
  // Gastos corrientes = todos menos los que son bien de inversión (se amortizan).
  const gastosCorrientes = data.gastos.filter(
    (g) => anioDeFecha(g.fecha) === ejercicio && !g.esBienInversion,
  );
  const tasaRet = tasaRetencion(config, ejercicio, params);

  // Amortización anual total de los bienes vivos en el ejercicio.
  const amortizacionesTotales = redondear(
    data.bienes.reduce((s, b) => {
      const adqYear = anioDeFecha(b.fechaAdquisicion);
      const dentroVida =
        adqYear <= ejercicio &&
        (b.aniosAmortizacion == null ||
          ejercicio <= adqYear + b.aniosAmortizacion - 1);
      return dentroVida ? s + amortizacionAnual(b) : s;
    }, 0),
  );

  // Acumulados hasta el final de un trimestre.
  const ingresosAcum = (t: Trimestre) =>
    redondear(
      ingresos
        .filter((i) => trimestreDeFecha(i.fecha) <= t)
        .reduce((s, i) => s + i.total, 0),
    );
  const retencionesAcum = (t: Trimestre) =>
    redondear(
      ingresos
        .filter((i) => i.retencionAplicable && trimestreDeFecha(i.fecha) <= t)
        .reduce((s, i) => s + i.base * tasaRet, 0),
    );
  const gastosCorrientesAcum = (t: Trimestre) =>
    redondear(
      gastosCorrientes
        .filter((g) => trimestreDeFecha(g.fecha) <= t)
        .reduce((s, g) => s + deducibleIrpf(g, config.situacionIva), 0),
    );
  // Amortización prorrateada por trimestre (anual × t/4).
  const gastosDeduciblesAcum = (t: Trimestre) =>
    redondear(gastosCorrientesAcum(t) + (amortizacionesTotales * t) / 4);

  // Los 4 pagos fraccionados, encadenando los previos.
  const trimestres: Modelo130Result[] = [];
  let pagosPrevios = 0;
  for (const t of [1, 2, 3, 4] as Trimestre[]) {
    const r = calcularModelo130({
      params,
      regimen: config.regimen,
      trimestre: t,
      ingresosAcumulados: ingresosAcum(t),
      gastosDeduciblesAcumulados: gastosDeduciblesAcum(t),
      retencionesSoportadasAcumuladas: retencionesAcum(t),
      pagosFraccionadosPreviosDelAnio: pagosPrevios,
    });
    trimestres.push(r);
    pagosPrevios = redondear(pagosPrevios + r.pagoTrimestre);
  }

  // Desglose por categoría (gastos corrientes).
  const porCat = new Map<CategoriaGasto, GastosPorCategoria>();
  for (const g of gastosCorrientes) {
    const cur =
      porCat.get(g.categoria) ??
      { categoria: g.categoria, base: 0, cuotaIva: 0, total: 0, deducible: 0 };
    cur.base = redondear(cur.base + g.base);
    cur.cuotaIva = redondear(cur.cuotaIva + g.cuotaIva);
    cur.total = redondear(cur.total + g.total);
    cur.deducible = redondear(cur.deducible + deducibleIrpf(g, config.situacionIva));
    porCat.set(g.categoria, cur);
  }
  const gastosPorCategoria = CATEGORIAS_GASTO.map((c) => porCat.get(c)).filter(
    (x): x is GastosPorCategoria => x != null,
  );

  const q4 = trimestres[3];
  const gastosCorrientesTotal = gastosCorrientesAcum(4);
  const gastosDeduciblesTotales = redondear(
    gastosCorrientesTotal + amortizacionesTotales,
  );

  return {
    ejercicio,
    ingresosTotales: ingresosAcum(4),
    gastosDeduciblesTotales,
    gastosCorrientes: gastosCorrientesTotal,
    amortizacionesTotales,
    gastosDificilJustificacion: q4.gastosDificilJustificacion,
    rendimientoNeto: q4.rendimientoNeto,
    retencionesSoportadas: retencionesAcum(4),
    pagosFraccionados: redondear(
      trimestres.reduce((s, r) => s + r.pagoTrimestre, 0),
    ),
    gastosPorCategoria,
    trimestres,
  };
}

/** El resultado del modelo 130 de un trimestre concreto (para el dashboard). */
export function modelo130DeTrimestre(
  data: FiscalArrays,
  ejercicio: number,
  trimestre: Trimestre,
  params: ParamsFiscales,
): Modelo130Result {
  return calcularResumenAnual(data, ejercicio, params).trimestres[trimestre - 1];
}
