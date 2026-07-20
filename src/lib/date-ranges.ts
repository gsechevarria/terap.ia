/**
 * Presets de rango de fechas para el filtro de citas. Funciones puras: reciben
 * la fecha de referencia (se calcula "hoy" fuera del render, en el server
 * component). Devuelven `{ from, to }` como `YYYY-MM-DD` con `to` INCLUSIVO
 * (el día final entra); la capa de query lo convierte a límite exclusivo.
 */

export type DateRange = { from: string; to: string };
export type PresetKey =
  | "this-month"
  | "last-month"
  | "next-30"
  | "last-30"
  | "this-year";

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function at(y: number, m: number, day: number): Date {
  return new Date(y, m, day);
}

export function presetRange(key: PresetKey, ref: Date): DateRange {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  switch (key) {
    case "this-month":
      return { from: ymd(at(y, m, 1)), to: ymd(at(y, m + 1, 0)) };
    case "last-month":
      return { from: ymd(at(y, m - 1, 1)), to: ymd(at(y, m, 0)) };
    case "next-30":
      return { from: ymd(ref), to: ymd(at(y, m, d + 29)) };
    case "last-30":
      return { from: ymd(at(y, m, d - 29)), to: ymd(ref) };
    case "this-year":
      return { from: ymd(at(y, 0, 1)), to: ymd(at(y, 11, 31)) };
  }
}

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "Este mes" },
  { key: "last-month", label: "Mes pasado" },
  { key: "next-30", label: "Próximos 30 días" },
  { key: "last-30", label: "Últimos 30 días" },
  { key: "this-year", label: "Este año" },
];

/** Valida `YYYY-MM-DD` y que sea una fecha real. */
export function isValidYMD(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && ymd(d) === s;
}

/** `YYYY-MM-DD` → ISO UTC a las 00:00 (límite inferior inclusivo). */
export function fromDateToISO(ymdStr: string): string {
  return `${ymdStr}T00:00:00.000Z`;
}

/** `YYYY-MM-DD` inclusivo → ISO UTC del día siguiente a las 00:00 (límite superior exclusivo). */
export function toDateToISO(ymdStr: string): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10) + "T00:00:00.000Z";
}
