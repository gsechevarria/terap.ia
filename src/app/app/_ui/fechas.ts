import { TZ, parseYMD, todayYMD, ymdInTZ } from "@/lib/tz";

/*
 * Formateadores de la app del paciente. El diseño descompone la fecha (día
 * grande, mes en versalitas, día de la semana aparte), y `lib/format.ts` solo
 * ofrece cadenas ya compuestas.
 *
 * Todos fijan `timeZone: TZ` por el mismo motivo que los de `lib/format.ts`:
 * el runtime de Vercel es UTC y, sin fijarlo, el servidor y el navegador
 * renderizan horas distintas para la misma cita —y entre las 00:00 y las 02:00
 * en España, días distintos—.
 */

function parte(iso: string, opciones: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString("es-ES", { timeZone: TZ, ...opciones });
}

/** Día del mes, sin cero delante: el número grande de la tarjeta. */
export function diaDelMes(iso: string): string {
  return parte(iso, { day: "numeric" });
}

/** "SEPTIEMBRE" — el mes completo, para poner en versalitas por CSS. */
export function mesLargo(iso: string): string {
  return parte(iso, { month: "long" });
}

/** "sept" — mes abreviado, para las líneas de una sola fila. */
export function mesCorto(iso: string): string {
  return parte(iso, { month: "short" }).replace(".", "");
}

/** "lunes" — el día de la semana; el CSS lo capitaliza. */
export function diaSemana(iso: string): string {
  return parte(iso, { weekday: "long" });
}

/** "LUN" — tres letras para la columna del historial. */
export function diaSemanaCorto(iso: string): string {
  return parte(iso, { weekday: "short" }).replace(".", "").slice(0, 3);
}

/** "SEPTIEMBRE 2026" — la píldora de mes sobre la tarjeta de cita. */
export function mesYAno(iso: string): string {
  return parte(iso, { month: "long", year: "numeric" });
}

/** "martes, 15 de septiembre" — la línea superior del saludo. */
export function fechaLarga(iso: string): string {
  return parte(iso, { weekday: "long", day: "numeric", month: "long" });
}

/** "15 sept" — fecha compacta para el historial del diario. */
export function fechaCompacta(iso: string): string {
  return parte(iso, { day: "numeric", month: "short" }).replace(".", "");
}

/**
 * "Hoy" / "Mañana" / el día de la semana. `hoy` y `manana` llegan resueltos
 * desde quien llama (en hora española) para no calcular "ahora" durante el
 * render, que es lo que rompía la hidratación en la versión anterior.
 */
export function etiquetaDia(iso: string, hoy: string, manana: string): string {
  const dia = ymdInTZ(new Date(iso));
  if (dia === hoy) return "Hoy";
  if (dia === manana) return "Mañana";
  return diaSemana(iso);
}

/*
 * Variantes para fechas de CALENDARIO ('YYYY-MM-DD': `entry_date`, `due_date`,
 * "hoy"). `parseYMD` las ancla a medianoche UTC y España va por delante de
 * UTC, así que formatearlas en TZ devuelve el mismo día del calendario. Es el
 * único sentido en que la conversión es segura; al revés no lo sería.
 */
const deYMD = (ymd: string) => parseYMD(ymd).toISOString();

/** "martes, 15 de septiembre" a partir de 'YYYY-MM-DD'. */
export function fechaLargaYMD(ymd: string): string {
  return fechaLarga(deYMD(ymd));
}

/** "15 sept" a partir de 'YYYY-MM-DD'. */
export function fechaCompactaYMD(ymd: string): string {
  return fechaCompacta(deYMD(ymd));
}

/** Día del mes a partir de 'YYYY-MM-DD'. */
export function diaDelMesYMD(ymd: string): string {
  return diaDelMes(deYMD(ymd));
}

/** "LUN" a partir de 'YYYY-MM-DD'. */
export function diaSemanaCortoYMD(ymd: string): string {
  return diaSemanaCorto(deYMD(ymd));
}

/** Agrupa por "mes año" conservando el orden de entrada. */
export function agruparPorMes<T>(
  filas: T[],
  fecha: (fila: T) => string,
): { titulo: string; filas: T[] }[] {
  const grupos: { titulo: string; filas: T[] }[] = [];
  for (const fila of filas) {
    const titulo = mesYAno(fecha(fila));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === titulo) ultimo.filas.push(fila);
    else grupos.push({ titulo, filas: [fila] });
  }
  return grupos;
}

/** Fecha 'YYYY-MM-DD' de hoy, reexportada para no importar de dos sitios. */
export { todayYMD };
