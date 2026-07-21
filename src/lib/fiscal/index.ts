/** API pública del motor fiscal (orientativo, sin facturación). */
export * from "./types";
export { getParams, hayParamsExactos, EJERCICIO_MAS_RECIENTE } from "./parametros";
export type { ParamsFiscales } from "./parametros";
export {
  redondear,
  trimestreDeFecha,
  anioDeFecha,
  deducibleIrpf,
  amortizacionAnual,
  tasaRetencion,
} from "./helpers";
export { calcularModelo130, type Modelo130Input } from "./modelo130";
export { calcularResumenAnual, modelo130DeTrimestre } from "./resumenAnual";
export {
  construirLibros,
  libroIngresos,
  libroGastos,
  libroBienesInversion,
  type Libro,
  type FiltroPeriodo,
} from "./libros";
export {
  trimestreActual,
  proximoVencimiento,
  alertasVencimiento,
  vencimientosModelo130,
  vencimientoRenta,
  type Vencimiento,
  type VencimientoConDias,
} from "./calendario";
