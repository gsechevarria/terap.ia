// Tipado de la definición JSONB de una escala (catálogo `scales.definition`).

export type ScaleOption = { value: number; label: string };
export type ScaleItem = { id: number; text: string };
export type SeverityRange = { min: number; max: number; label: string };

export type ScaleDefinition = {
  options: ScaleOption[];
  items: ScaleItem[];
  scoring: {
    method: string;
    min: number;
    max: number;
    severity: SeverityRange[];
  };
  flag_item?: number;
  flag_threshold?: number;
};

export type ScaleAnswers = Record<string, number>;

export type ScaleValidation =
  | { ok: true }
  | { ok: false; reason: "incompleta" | "fuera_de_rango" | "items_extra" };

/**
 * Valida que una respuesta esté COMPLETA y dentro del rango declarado.
 *
 * La barrera real está en el trigger `compute_scale_response` (cubre cualquier
 * ruta de inserción); esta función existe para dar un mensaje inmediato en la
 * server action y para poder probar las reglas sin base de datos.
 */
export function validateAnswers(
  def: ScaleDefinition,
  answers: ScaleAnswers,
): ScaleValidation {
  const valores = new Set(def.options.map((o) => o.value));
  const ids = def.items.map((i) => String(i.id));
  const claves = Object.keys(answers ?? {});

  for (const id of ids) {
    const v = answers?.[id];
    if (v == null || !Number.isInteger(v)) return { ok: false, reason: "incompleta" };
    if (!valores.has(v)) return { ok: false, reason: "fuera_de_rango" };
  }
  if (claves.length !== ids.length) return { ok: false, reason: "items_extra" };
  return { ok: true };
}

export type ScaleScore = {
  score: number;
  severity: string | null;
  flagged: boolean;
};

/**
 * Puntuación, severidad y marca del ítem de riesgo.
 *
 * Réplica en TypeScript de lo que hace el trigger en Postgres, para poder
 * probar los tramos con casos escritos a mano. La BD sigue siendo la fuente de
 * verdad: aquí NO se decide nada que se guarde.
 *
 * Suma SOLO los ítems de la definición: sumar cualquier clave del JSONB era lo
 * que permitía puntuar un PHQ-9 con 3 respuestas.
 */
export function scoreScale(
  def: ScaleDefinition,
  answers: ScaleAnswers,
): ScaleScore {
  const score = def.items.reduce(
    (s, it) => s + (answers[String(it.id)] ?? 0),
    0,
  );
  const severity =
    def.scoring.severity.find((r) => score >= r.min && score <= r.max)?.label ??
    null;

  let flagged = false;
  if (def.flag_item != null) {
    const v = answers[String(def.flag_item)];
    // Sin `?? 0`: si el ítem de riesgo falta, NO se puede afirmar que no esté
    // marcado. Ese `coalesce(..., 0)` era lo que ocultaba la ideación suicida.
    flagged = v != null && v >= (def.flag_threshold ?? 1);
  }
  return { score, severity, flagged };
}
