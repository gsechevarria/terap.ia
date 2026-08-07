import { fromWallClock, lastDayOfMonth, wallClockParts } from "@/lib/tz";

export type Freq = "none" | "daily" | "weekly" | "biweekly" | "monthly";

/**
 * i-ésima ocurrencia de una serie, contada SIEMPRE desde la cita original.
 *
 * Vivía dentro de `actions/appointments.ts` (fichero `"use server"`, no
 * importable desde un test). Dos motivos para no usar `setDate`/`setMonth` ni
 * encadenar desde la ocurrencia anterior:
 *
 *  - `setDate`/`setMonth` operan en la zona del proceso (UTC en Vercel), que no
 *    preserva la hora de pared en Madrid: una serie semanal que cruzase el fin
 *    del horario de verano se desplazaba una hora a partir de ahí.
 *  - Encadenar desde la anterior pierde el día original en cuanto un mes lo
 *    recorta: 31-ene → 28-feb dejaba la serie clavada en el 28 (28-mar,
 *    28-abr…). Anclando en la cita original vuelve al 31 cuando el mes da.
 */
export function occurrenceAt(anchor: Date, freq: Freq, i: number): Date {
  const { y, m, d, hh, mm } = wallClockParts(anchor);
  if (freq === "daily") return fromWallClock(y, m, d + i, hh, mm);
  if (freq === "weekly") return fromWallClock(y, m, d + 7 * i, hh, mm);
  if (freq === "biweekly") return fromWallClock(y, m, d + 14 * i, hh, mm);
  if (freq === "monthly") {
    // Normaliza el año antes de recortar el día: `lastDayOfMonth` necesita un
    // mes real y la serie puede saltar de diciembre a enero (o más allá).
    const total = m - 1 + i;
    const ny = y + Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return fromWallClock(ny, nm, Math.min(d, lastDayOfMonth(ny, nm)), hh, mm);
  }
  return anchor;
}

/** Las `count` primeras ocurrencias, incluida la original (índice 0). */
export function occurrenceSeries(
  anchor: Date,
  freq: Freq,
  count: number,
): Date[] {
  return Array.from({ length: count }, (_, i) => occurrenceAt(anchor, freq, i));
}
