import { TZ, fromWallClock, todayYMD, wallClockParts, ymdParts } from "@/lib/tz";

/*
 * Todos los formateadores fijan `timeZone: TZ`. Sin ello, el mismo instante se
 * renderiza en UTC en el servidor (runtime de Vercel) y en hora de Madrid en el
 * cliente: dos horas distintas para la misma cita, y desajuste de hidratación.
 */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo la hora, 'HH:MM' en la zona del profesional. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-ES", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * ISO → valor para `<input type="datetime-local">`, en hora de pared de TZ.
 *
 * Antes usaba `getHours()` y compañía, que son hora del proceso: en SSR (UTC)
 * el input se pintaba con 2 h de menos y, si el profesional guardaba antes de
 * que hidratara, la cita se movía. Su inversa es `fromDatetimeLocal`.
 */
export function toDatetimeLocal(iso: string): string {
  const { y, m, d, hh, mm } = wallClockParts(new Date(iso));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(m)}-${p(d)}T${p(hh)}:${p(mm)}`;
}

/**
 * Valor de `<input type="datetime-local">` → instante. Inversa exacta de
 * `toDatetimeLocal`: interpreta el valor como hora de pared en TZ, no en la
 * zona del navegador (un profesional de viaje no debe mover las citas).
 * Devuelve `null` si el valor está vacío o mal formado.
 */
export function fromDatetimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  return fromWallClock(Number(y), Number(m), Number(d), Number(hh), Number(mm));
}

/**
 * Edad en años a partir de una fecha 'YYYY-MM-DD'. "Hoy" se resuelve en TZ, no
 * en la zona del proceso: entre las 00:00 y las 02:00 en España el servidor
 * (UTC) sigue en el día anterior y la edad saltaba un día antes de tiempo.
 */
export function ageFromBirthDate(date: string | null | undefined): number | null {
  if (!date) return null;
  const birth = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!birth) return null;
  const by = Number(birth[1]);
  const bm = Number(birth[2]);
  const bd = Number(birth[3]);
  const [ty, tm, td] = ymdParts(todayYMD());
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function formatCurrency(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    cents / 100,
  );
}

/** Importe ya en EUROS (no céntimos). Para el módulo fiscal (`lib/fiscal`). */
export function formatEur(euros: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    euros,
  );
}
