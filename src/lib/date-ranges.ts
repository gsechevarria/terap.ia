import { formatYMD, fromWallClock, todayYMD } from "@/lib/tz";

/**
 * Presets de rango de fechas para el filtro de citas. Funciones puras: reciben
 * la fecha de referencia (se calcula "hoy" fuera del render, en el server
 * component). Devuelven `{ from, to }` como `YYYY-MM-DD` con `to` INCLUSIVO
 * (el día final entra); la capa de query lo convierte a límite exclusivo.
 *
 * El día de calendario de la referencia se resuelve en la zona del profesional:
 * con el runtime en UTC, entre las 00:00 y las 02:00 de España "este mes" podía
 * ser el mes anterior.
 */

export type DateRange = { from: string; to: string };
export type PresetKey =
  | "this-month"
  | "last-month"
  | "next-30"
  | "last-30"
  | "this-year";

/** Fecha de calendario a partir de componentes, con desbordamiento normalizado. */
function at(y: number, monthIndex: number, day: number): string {
  return formatYMD(new Date(Date.UTC(y, monthIndex, day)));
}

export function presetRange(key: PresetKey, ref: Date): DateRange {
  const [y, m, d] = todayYMD(ref).split("-").map(Number);
  const mi = m - 1; // índice de mes base 0
  switch (key) {
    case "this-month":
      return { from: at(y, mi, 1), to: at(y, mi + 1, 0) };
    case "last-month":
      return { from: at(y, mi - 1, 1), to: at(y, mi, 0) };
    case "next-30":
      return { from: at(y, mi, d), to: at(y, mi, d + 29) };
    case "last-30":
      return { from: at(y, mi, d - 29), to: at(y, mi, d) };
    case "this-year":
      return { from: at(y, 0, 1), to: at(y, 11, 31) };
  }
}

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "Este mes" },
  { key: "last-month", label: "Mes pasado" },
  { key: "next-30", label: "Próximos 30 días" },
  { key: "last-30", label: "Últimos 30 días" },
  { key: "this-year", label: "Este año" },
];

/** Valida `YYYY-MM-DD` y que sea una fecha real (31 de febrero no cuela). */
export function isValidYMD(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return at(y, m - 1, d) === s;
}

/**
 * `YYYY-MM-DD` → instante de la medianoche **de Madrid** (límite inferior
 * inclusivo). Antes devolvía medianoche UTC, lo que desplazaba el filtro 1-2 h
 * y colaba en el rango las citas o pagos de la última franja del día anterior.
 */
export function fromDateToISO(ymdStr: string): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return fromWallClock(y, m, d, 0, 0).toISOString();
}

/** `YYYY-MM-DD` inclusivo → medianoche de Madrid del día siguiente (exclusivo). */
export function toDateToISO(ymdStr: string): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return fromWallClock(y, m, d + 1, 0, 0).toISOString();
}
