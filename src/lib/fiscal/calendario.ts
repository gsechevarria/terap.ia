/**
 * Calendario fiscal — fechas de presentación y alertas de vencimiento.
 * Funciones PURAS: reciben la fecha de referencia (se calcula "hoy" fuera del
 * render, en el server component) y los parámetros del ejercicio.
 */
import type { Trimestre } from "./types";
import type { ParamsFiscales } from "./parametros";

export interface Vencimiento {
  modelo: "modelo130" | "renta";
  ejercicio: number;
  trimestre?: Trimestre;
  etiqueta: string;
  /** Fecha límite como YYYY-MM-DD (día local, sin hora). */
  fechaLimiteYMD: string;
}

const DAY = 86400e3;
const p2 = (n: number) => String(n).padStart(2, "0");

function ymd(year: number, mmdd: string): string {
  return `${year}-${mmdd}`; // mmdd ya viene como "MM-DD"
}
function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
/** Medianoche local de un YYYY-MM-DD (comparación por día, sin desfase de huso). */
function localMidnight(ymdStr: string): number {
  return new Date(`${ymdStr}T00:00:00`).getTime();
}

/** Trimestre natural (1–4) y año de una fecha de referencia. */
export function trimestreActual(ref: Date): { trimestre: Trimestre; anio: number } {
  return {
    trimestre: (Math.floor(ref.getMonth() / 3) + 1) as Trimestre,
    anio: ref.getFullYear(),
  };
}

/** Los 4 vencimientos del modelo 130 de un ejercicio (el 4T se presenta en enero del año siguiente). */
export function vencimientosModelo130(
  ejercicio: number,
  params: ParamsFiscales,
): Vencimiento[] {
  const f = params.fechasPresentacion.modelo130;
  return [
    { modelo: "modelo130", ejercicio, trimestre: 1, etiqueta: `Modelo 130 · 1T ${ejercicio}`, fechaLimiteYMD: ymd(ejercicio, f.Q1) },
    { modelo: "modelo130", ejercicio, trimestre: 2, etiqueta: `Modelo 130 · 2T ${ejercicio}`, fechaLimiteYMD: ymd(ejercicio, f.Q2) },
    { modelo: "modelo130", ejercicio, trimestre: 3, etiqueta: `Modelo 130 · 3T ${ejercicio}`, fechaLimiteYMD: ymd(ejercicio, f.Q3) },
    { modelo: "modelo130", ejercicio, trimestre: 4, etiqueta: `Modelo 130 · 4T ${ejercicio}`, fechaLimiteYMD: ymd(ejercicio + 1, f.Q4) },
  ];
}

/** Fin de plazo de la Renta de un ejercicio (campaña del año siguiente). */
export function vencimientoRenta(
  ejercicio: number,
  params: ParamsFiscales,
): Vencimiento {
  return {
    modelo: "renta",
    ejercicio,
    etiqueta: `Declaración de la Renta ${ejercicio}`,
    fechaLimiteYMD: ymd(ejercicio + 1, params.fechasPresentacion.renta.fin),
  };
}

/** Todos los vencimientos relevantes alrededor de la fecha de referencia. */
function vencimientosAlrededor(ref: Date, params: ParamsFiscales): Vencimiento[] {
  const y = ref.getFullYear();
  const out: Vencimiento[] = [];
  for (const ej of [y - 1, y, y + 1]) {
    out.push(...vencimientosModelo130(ej, params), vencimientoRenta(ej, params));
  }
  return out.sort((a, b) => a.fechaLimiteYMD.localeCompare(b.fechaLimiteYMD));
}

export interface VencimientoConDias extends Vencimiento {
  diasRestantes: number;
}

function conDias(v: Vencimiento, ref: Date): VencimientoConDias {
  const refMid = new Date(ymdOf(ref) + "T00:00:00").getTime();
  const diasRestantes = Math.round((localMidnight(v.fechaLimiteYMD) - refMid) / DAY);
  return { ...v, diasRestantes };
}

/** Próximo vencimiento con fecha límite >= hoy (o null si no hay). */
export function proximoVencimiento(
  ref: Date,
  params: ParamsFiscales,
): VencimientoConDias | null {
  const hoy = ymdOf(ref);
  const siguiente = vencimientosAlrededor(ref, params).find(
    (v) => v.fechaLimiteYMD >= hoy,
  );
  return siguiente ? conDias(siguiente, ref) : null;
}

/** Vencimientos dentro de los próximos `dias` (para banners de alerta). */
export function alertasVencimiento(
  ref: Date,
  params: ParamsFiscales,
  dias = 45,
): VencimientoConDias[] {
  return vencimientosAlrededor(ref, params)
    .map((v) => conDias(v, ref))
    .filter((v) => v.diasRestantes >= 0 && v.diasRestantes <= dias);
}
