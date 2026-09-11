/**
 * Toda la aritmética y el formateo de fechas del dominio se hace en la zona
 * del profesional (España peninsular). El runtime del servidor es UTC, así que
 * NUNCA se puede depender de la zona local del proceso.
 *
 * Dos tipos de fecha conviven aquí y no deben mezclarse:
 *
 *  - **Instante** (`appointments.starts_at`, `created_at`…): un punto en el
 *    tiempo. Para leerlo o escribirlo como hora de pared se usa
 *    `wallClockParts` / `fromWallClock`.
 *  - **Fecha de calendario** (`tasks.due_date`, `gastos.fecha`, el `?date=` de
 *    la agenda…): un día sin hora ni zona. Se representa como `'YYYY-MM-DD'` y
 *    su aritmética va por `parseYMD` / `addDaysYMD` / `formatYMD`, que anclan a
 *    UTC precisamente para que sumar días nunca dependa del horario de verano.
 */
export const TZ = "Europe/Madrid";

/**
 * `hourCycle: 'h23'` es obligatorio: con `hour12: false` algunas versiones de
 * ICU devuelven "24" para la medianoche, lo que corrompería `wallClockParts`.
 */
const WALL_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const partsOf = (d: Date): Record<string, string> =>
  WALL_FMT.formatToParts(d).reduce<Record<string, string>>(
    (a, p) => ((a[p.type] = p.value), a),
    {},
  );

/** Componentes de la hora de pared en TZ para un instante dado. */
export function wallClockParts(d: Date) {
  const p = partsOf(d);
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hh: Number(p.hour),
    mm: Number(p.minute),
  };
}

/**
 * Offset de TZ en el instante dado, en ms (hora de pared − UTC): +1 h en CET,
 * +2 h en CEST. Se resuelve con `Intl` y no con la zona del proceso.
 */
function offsetAt(ms: number): number {
  const p = partsOf(new Date(ms));
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUTC - ms;
}

/**
 * Instante UTC correspondiente a una hora de pared en TZ.
 * Resuelve el offset real de esa fecha concreta (CET o CEST), por lo que es
 * correcto también al cruzar el cambio de horario.
 *
 * La segunda pasada es necesaria: la primera estima el offset en un instante
 * que puede caer al otro lado de la transición (la madrugada del último domingo
 * de marzo/octubre) y devolvería una hora desplazada.
 *
 * Los componentes se normalizan (`m = 13` → enero del año siguiente, `d = 32` →
 * el día 1 del mes siguiente), igual que `Date.UTC`.
 */
export function fromWallClock(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const normal = new Date(guess);
  const offsets = new Set([offsetAt(guess - 86400000), offsetAt(guess), offsetAt(guess + 86400000)]);
  const candidates = [...offsets].map(offset => guess - offset).filter(t => {
    const p = wallClockParts(new Date(t));
    return p.y === normal.getUTCFullYear() && p.m === normal.getUTCMonth() + 1 && p.d === normal.getUTCDate() && p.hh === normal.getUTCHours() && p.mm === normal.getUTCMinutes();
  });
  // La hora inexistente se rechaza; una hora repetida elige la primera ocurrencia.
  return new Date(candidates.length ? Math.min(...candidates) : NaN);
}

/** Día de calendario en TZ ('YYYY-MM-DD') al que pertenece un instante. */
export function ymdInTZ(d: Date): string {
  const p = partsOf(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "Hoy" en TZ como 'YYYY-MM-DD', resuelto sin depender de la zona del proceso. */
export function todayYMD(now: Date = new Date()): string {
  return ymdInTZ(now);
}

/** Minutos transcurridos desde la medianoche en TZ para un instante dado. */
export function minutesOfDayInTZ(d: Date): number {
  const { hh, mm } = wallClockParts(d);
  return hh * 60 + mm;
}

/** Último día del mes (1-12) del año dado. */
export function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/* -------------------------------------------------- fechas de calendario --- */

/**
 * `'YYYY-MM-DD'` → instante de medianoche **UTC**. El ancla en UTC es
 * deliberada: estas fechas no tienen zona, y anclarlas en UTC hace que sumar
 * días (`addDaysYMD`) sea exacto también cuando el rango cruza un cambio de
 * horario. Para obtener el instante real de un día a una hora concreta en TZ,
 * usar `fromWallClock`, no esto.
 */
/**
 * `'YYYY-MM-DD'` → `[año, mes(1-12), día]`.
 *
 * Devuelve una TUPLA de longitud fija a propósito: con
 * `noUncheckedIndexedAccess`, el `const [y, m, d] = s.split("-").map(Number)`
 * que había repartido por el repo tipa las tres como `number | undefined`, y
 * ese es justo el caso que producía `Invalid Date` en silencio cuando la cadena
 * venía mal formada. Los `NaN` se propagan de forma visible.
 */
export function ymdParts(s: string): [number, number, number] {
  const p = s.split("-");
  return [Number(p[0]), Number(p[1]), Number(p[2])];
}

export function parseYMD(s: string): Date {
  const [y, m, d] = ymdParts(s);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Inversa de `parseYMD`: instante anclado en UTC → `'YYYY-MM-DD'`. */
export function formatYMD(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** Suma días a una fecha de calendario anclada en UTC (inmutable). */
export function addDaysYMD(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Lunes de la semana de una fecha de calendario anclada en UTC. */
export function mondayOfYMD(d: Date): Date {
  return addDaysYMD(d, -((d.getUTCDay() + 6) % 7));
}
