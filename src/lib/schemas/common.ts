import { z } from "zod";
import { ymdParts } from "@/lib/tz";

/**
 * Piezas compartidas por los esquemas de las server actions.
 *
 * Una server action es un endpoint HTTP: el tipo de TypeScript no existe en
 * runtime y el `FormData` llega tal cual del navegador. Hasta ahora la
 * conversión era `Number(str) || 0`, que degradaba en silencio: `"abc"` y
 * `"1.234,56"` se guardaban como 0 € sin ningún error, y un `"0"` explícito en
 * el % de afectación se convertía en 100 % por el `|| 100`.
 */

export const UUID = z.string().uuid("Identificador no válido.");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Comprobación de UUID sin zod, para las capas de query.
 *
 * Necesaria antes de interpolar un identificador en un `.or()` de PostgREST:
 * las comas y los paréntesis delimitan su sintaxis, así que un segmento de URL
 * manipulado podía reescribir el filtro entero.
 */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** `YYYY-MM-DD` real (rechaza el 31 de febrero). */
export const YMD = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.")
  .refine((s) => {
    const [y, m, d] = ymdParts(s);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, "La fecha no existe.");

/**
 * Importe escrito por una persona, en formato español.
 *
 * `"1.234,56"` → 1234.56. El código anterior hacía `replace(",", ".")`, que
 * solo sustituye la PRIMERA coma: `"1.234,56"` quedaba en `"1.234.56"` → NaN →
 * 0 céntimos guardados sin avisar.
 */
const MSG_IMPORTE = "Introduce un importe válido (por ejemplo 1.234,56).";

/** `"1.234,56"` → `1234.56`. Quita los puntos de millar ANTES de la coma decimal. */
function parseEsNumber(raw: string): number {
  return Number(raw.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
}

export const importeEuros = z
  .string()
  .trim()
  // `Number("")` es 0: sin esto, un campo vacío se guardaría como 0 € en vez de
  // pedir el dato, que es justo la degradación silenciosa que se quiere evitar.
  .min(1, "Introduce un importe.")
  .transform(parseEsNumber)
  .refine((n) => Number.isFinite(n), MSG_IMPORTE)
  .refine((n) => n >= 0, "El importe no puede ser negativo.");

/** Porcentaje entero 0-100. Distingue el 0 explícito de "campo vacío". */
export const porcentaje = z
  .string()
  .trim()
  .min(1, "Introduce un porcentaje entre 0 y 100.")
  .transform((raw) => Number(raw.replace(",", ".")))
  .refine(
    (n) => Number.isFinite(n) && n >= 0 && n <= 100,
    "Introduce un porcentaje entre 0 y 100.",
  )
  .transform((n) => Math.round(n));

/** Texto opcional: cadena vacía → null (no `undefined`, que borraría el campo). */
export const textoOpcional = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable();

/** Convierte un `FormData` en un objeto plano para `safeParse`. */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (v instanceof File) continue; // los ficheros se tratan aparte
    out[k] = v;
  }
  return out;
}

/**
 * Valida y lanza con el primer mensaje legible.
 *
 * Se lanza en vez de degradar a un valor por defecto: el cliente ya envuelve
 * las actions (`useAction`) y muestra el mensaje sin perder el formulario.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const res = schema.safeParse(value);
  if (!res.success) {
    const first = res.error.issues[0];
    throw new Error(first?.message ?? "Datos no válidos.");
  }
  return res.data;
}
