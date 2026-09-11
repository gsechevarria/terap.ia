/**
 * Cálculo del pago fraccionado (modelo 130) — ORIENTATIVO.
 *
 *   rendimientoNeto = ingresosAcumulados − gastosDeduciblesAcumulados
 *   gastosDificil   = simplificada && rendimientoNeto>0
 *                       ? min(rendimientoNeto × pct, tope)   (5% con tope 2000 €/año)
 *                       : 0
 *   base            = rendimientoNeto − gastosDificil
 *   pagoTrimestre   = max(0, base × 0.20
 *                            − retencionesSoportadasAcumuladas
 *                            − pagosFraccionadosPreviosDelAño)
 *
 * El "5% de gastos de difícil justificación" es anual con tope; aplicado sobre
 * el acumulado trimestral es una aproximación (se ajusta al cierre del año).
 * Devuelve el desglose bruto para que el gestor pueda recalcular.
 */
import type { Modelo130Result, Regimen, Trimestre } from "./types";
import { parametrosNoVerificados, type ParamsFiscales } from "./parametros";
import { redondear } from "./helpers";

export interface Modelo130Input {
  params: ParamsFiscales;
  regimen: Regimen;
  trimestre: Trimestre;
  ingresosAcumulados: number;
  gastosDeduciblesAcumulados: number;
  retencionesSoportadasAcumuladas: number;
  pagosFraccionadosPreviosDelAnio: number;
}

export function calcularModelo130(input: Modelo130Input): Modelo130Result {
  const {
    params,
    regimen,
    trimestre,
    ingresosAcumulados,
    gastosDeduciblesAcumulados,
    retencionesSoportadasAcumuladas,
    pagosFraccionadosPreviosDelAnio,
  } = input;

  const rendimientoNeto = redondear(
    ingresosAcumulados - gastosDeduciblesAcumulados,
  );

  // El tope de difícil justificación es ANUAL. Aplicarlo íntegro en cada
  // trimestre acumulado hacía que, con un rendimiento alto ya en el 1T, se
  // declararan de menos los tres primeros trimestres y todo reapareciera como
  // regularización en el 4T. Se prorratea por trimestres transcurridos.
  const topePeriodo =
    (params.gastosDificilJustificacionTope.valor * trimestre) / 4;

  const gastosDificilJustificacion =
    regimen === "estimacion_directa_simplificada" && rendimientoNeto > 0
      ? redondear(
          Math.min(
            rendimientoNeto * params.gastosDificilJustificacionPct.valor,
            topePeriodo,
          ),
        )
      : 0;

  const baseLiquidacion = redondear(rendimientoNeto - gastosDificilJustificacion);
  const tipoAplicado = params.irpfPagoFraccionado;
  const cuota = redondear(Math.max(0, baseLiquidacion) * tipoAplicado);

  const pagoTrimestre = redondear(
    Math.max(
      0,
      cuota -
        retencionesSoportadasAcumuladas -
        pagosFraccionadosPreviosDelAnio,
    ),
  );

  // Si el cálculo depende de un parámetro sin confirmar contra la AEAT, el
  // resultado viaja marcado para que la UI y el export lo adviertan. Solo
  // importa cuando el régimen simplificado hace intervenir esos parámetros.
  const usaDificilJustificacion =
    regimen === "estimacion_directa_simplificada" && rendimientoNeto > 0;
  const noVerificados = usaDificilJustificacion
    ? parametrosNoVerificados(params)
    : [];

  return {
    trimestre,
    ingresosAcumulados: redondear(ingresosAcumulados),
    gastosDeduciblesAcumulados: redondear(gastosDeduciblesAcumulados),
    rendimientoNeto,
    gastosDificilJustificacion,
    baseLiquidacion,
    tipoAplicado,
    cuota,
    retencionesAcumuladas: redondear(retencionesSoportadasAcumuladas),
    pagosFraccionadosPrevios: redondear(pagosFraccionadosPreviosDelAnio),
    pagoTrimestre,
    parametrosNoVerificados: noVerificados,
    estimacionNoVerificada: noVerificados.length > 0,
  };
}
