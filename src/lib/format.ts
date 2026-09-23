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

/**
 * Fecha larga con el día de la semana: «Martes, 22 de septiembre».
 *
 * Va en la cabecera del panel, donde el año sobra —nadie necesita que le
 * recuerden en qué año está trabajando— y el día de la semana sí importa,
 * porque la consulta se organiza por días de la semana.
 */
export function formatFechaLarga(iso: string): string {
  const texto = new Date(iso).toLocaleDateString("es-ES", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // `es-ES` devuelve «martes, 22 de septiembre»; en español el día de la semana
  // va en minúscula, pero aquí encabeza la frase.
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Cómo nombrar el día de una cita futura dentro de una frase.
 *
 * Hoy no se nombra —«a las 17:32» ya se entiende—, mañana se dice con su
 * palabra, y a partir de ahí hace falta la fecha. Dentro de los seis días
 * siguientes basta el día de la semana, porque cada uno aparece una sola vez y
 * no hay ambigüedad posible; más allá, el día y el mes.
 *
 * Devuelve "" para hoy, de modo que quien lo use pueda concatenarlo sin
 * comprobar nada.
 */
export function nombreDelDia(iso: string, diasHasta: number): string {
  if (diasHasta <= 0) return "";
  if (diasHasta === 1) return "mañana";
  const opciones: Intl.DateTimeFormatOptions =
    diasHasta <= 6 ? { weekday: "long" } : { day: "numeric", month: "long" };
  return `el ${new Date(iso).toLocaleDateString("es-ES", { timeZone: TZ, ...opciones })}`;
}

/**
 * Cuánto falta, para la insignia de la tarjeta de próxima sesión.
 *
 * Por debajo de una hora van los minutos, porque es cuando importan. A partir
 * del día siguiente se cuenta en días: decir «en 31 h 12 min» obliga a hacer la
 * cuenta mentalmente para saber que es mañana.
 */
export function formatCuantoFalta(desdeISO: string, hastaISO: string, diasHasta: number): string {
  if (diasHasta === 1) return "mañana";
  if (diasHasta > 1) return `en ${diasHasta} días`;
  const minutos = Math.round(
    (new Date(hastaISO).getTime() - new Date(desdeISO).getTime()) / 60000,
  );
  if (minutos <= 0) return "ahora";
  if (minutos < 60) return `en ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `en ${horas} h` : `en ${horas} h ${resto} min`;
}

/** Minutos legibles: «1 h 30 min», «45 min», «2 h». */
export function formatDuracion(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
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
