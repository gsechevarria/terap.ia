/*
 * Pauta de medicación: lógica pura (sin base de datos), compartida por el
 * panel del profesional y la app del paciente.
 *
 * Es la TRANSCRIPCIÓN de lo que ha indicado el médico del paciente. Nada de
 * aquí calcula dosis, compara medicamentos ni sugiere cambios: solo valida que
 * lo anotado sea coherente y lo ordena para mostrarlo.
 *
 * Las restricciones repiten las `check` de 20261006100001_medicacion.sql. Se
 * validan aquí para dar un mensaje claro; la base es quien manda.
 */
import { z } from "zod";
import { ymdInTZ, wallClockParts } from "@/lib/tz";

export const MOMENTOS = ["manana", "mediodia", "tarde", "noche"] as const;
export type Momento = (typeof MOMENTOS)[number];
export const MOMENTO_LABEL: Record<Momento, string> = {
  manana: "Mañana",
  mediodia: "Mediodía",
  tarde: "Tarde",
  noche: "Noche",
};

export const FRECUENCIAS = ["diaria", "dias_semana", "si_precisa"] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];
export const FRECUENCIA_LABEL: Record<Frecuencia, string> = {
  diaria: "Todos los días",
  dias_semana: "Algunos días de la semana",
  si_precisa: "Solo si hace falta",
};

export const CON_COMIDA = [
  "indiferente",
  "con_comida",
  "en_ayunas",
  "antes_comida",
  "despues_comida",
] as const;
export type ConComida = (typeof CON_COMIDA)[number];
export const CON_COMIDA_LABEL: Record<ConComida, string> = {
  indiferente: "Con o sin comida",
  con_comida: "Con comida",
  en_ayunas: "En ayunas",
  antes_comida: "Antes de comer",
  despues_comida: "Después de comer",
};

/** ISO: 1 = lunes … 7 = domingo. */
export const DIAS = [1, 2, 3, 4, 5, 6, 7] as const;
export const DIA_CORTO: Record<number, string> = {
  1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S", 7: "D",
};
const DIA_LARGO: Record<number, string> = {
  1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 7: "domingo",
};

/** Aviso fijo que acompaña la pauta en la app del paciente. */
export const AVISO_PACIENTE =
  "No cambies ni dejes tu medicación sin consultarlo antes con tu médico. Si tienes dudas sobre cómo tomarla, pregunta a tu médico o a tu farmacéutico.";

export type Medicamento = {
  id: string;
  nombre: string;
  dosis: string;
  momentos: string[];
  horario: string | null;
  frecuencia: string;
  dias_semana: number[];
  con_comida: string;
  instrucciones: string | null;
  prescrito_por: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  retirada_at: string | null;
};

const texto = (max: number, campo: string) =>
  z
    .string()
    .trim()
    .min(1, `${campo}: es obligatorio.`)
    .max(max, `${campo}: máximo ${max} caracteres.`);
const opcional = (max: number, campo: string) =>
  z
    .string()
    .trim()
    .max(max, `${campo}: máximo ${max} caracteres.`)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .transform((v) => v ?? null);
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida.")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null))
  .transform((v) => v || null);

export const medicamentoSchema = z
  .object({
    nombre: texto(200, "Medicamento"),
    dosis: texto(200, "Dosis"),
    momentos: z.array(z.enum(MOMENTOS)).default([]),
    horario: opcional(120, "Horario"),
    frecuencia: z.enum(FRECUENCIAS),
    dias_semana: z.array(z.number().int().min(1).max(7)).default([]),
    con_comida: z.enum(CON_COMIDA),
    instrucciones: opcional(1000, "Instrucciones"),
    prescrito_por: texto(200, "Prescrito por"),
    fecha_inicio: fecha,
    fecha_fin: fecha,
  })
  .transform((m) => ({
    ...m,
    // Sin duplicados y en el orden del día / de la semana.
    momentos: MOMENTOS.filter((x) => m.momentos.includes(x)),
    dias_semana:
      m.frecuencia === "dias_semana"
        ? DIAS.filter((d) => m.dias_semana.includes(d)).map(Number)
        : [],
  }))
  .superRefine((m, ctx) => {
    if (m.frecuencia !== "si_precisa" && m.momentos.length === 0) {
      ctx.addIssue({ code: "custom", message: "Indica en qué momento del día se toma." });
    }
    if (m.frecuencia === "dias_semana" && m.dias_semana.length === 0) {
      ctx.addIssue({ code: "custom", message: "Indica qué días de la semana se toma." });
    }
    if (m.fecha_inicio && m.fecha_fin && m.fecha_fin < m.fecha_inicio) {
      ctx.addIssue({ code: "custom", message: "La fecha de fin no puede ser anterior a la de inicio." });
    }
  });
export type MedicamentoInput = z.input<typeof medicamentoSchema>;
export type MedicamentoValido = z.output<typeof medicamentoSchema>;

/** «Todos los días», «Lunes, miércoles y viernes», «Solo si hace falta». */
export function describeFrecuencia(m: Pick<Medicamento, "frecuencia" | "dias_semana">): string {
  if (m.frecuencia === "dias_semana" && m.dias_semana.length > 0) {
    const dias = [...m.dias_semana].sort((a, b) => a - b).map((d) => DIA_LARGO[d] ?? "");
    const lista =
      dias.length === 1 ? dias[0]! : `${dias.slice(0, -1).join(", ")} y ${dias.at(-1)}`;
    return lista.charAt(0).toUpperCase() + lista.slice(1);
  }
  return FRECUENCIA_LABEL[m.frecuencia as Frecuencia] ?? m.frecuencia;
}

export function describeMomentos(m: Pick<Medicamento, "momentos">): string {
  return MOMENTOS.filter((x) => m.momentos.includes(x))
    .map((x) => MOMENTO_LABEL[x])
    .join(" · ");
}

/** Día ISO de la semana (1-7) en hora de Madrid. */
export function diaSemanaMadrid(ahora: Date): number {
  const w = wallClockParts(ahora);
  const d = new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** ¿Forma parte de la pauta vigente hoy (no retirado y dentro de sus fechas)? */
export function vigente(m: Medicamento, ahora: Date = new Date()): boolean {
  if (m.retirada_at) return false;
  const hoy = ymdInTZ(ahora);
  if (m.fecha_inicio && hoy < m.fecha_inicio) return false;
  if (m.fecha_fin && hoy > m.fecha_fin) return false;
  return true;
}

export type TomaDeHoy = { momento: Momento; medicamentos: Medicamento[] };

/**
 * Lo que toca hoy, agrupado por momento del día. Los de «solo si hace falta»
 * no entran: no tienen hora. Es ordenar lo anotado, no decidir nada.
 */
export function pautaDeHoy(lista: Medicamento[], ahora: Date = new Date()): TomaDeHoy[] {
  const dia = diaSemanaMadrid(ahora);
  const hoy = lista.filter(
    (m) =>
      vigente(m, ahora) &&
      (m.frecuencia === "diaria" ||
        (m.frecuencia === "dias_semana" && m.dias_semana.includes(dia))),
  );
  return MOMENTOS.map((momento) => ({
    momento,
    medicamentos: hoy.filter((m) => m.momentos.includes(momento)),
  })).filter((t) => t.medicamentos.length > 0);
}
