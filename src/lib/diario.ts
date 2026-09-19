/**
 * Reglas del diario emocional, en un solo sitio.
 *
 * Las comparte la interfaz —para no dejar escribir de más ni habilitar el
 * botón sin elegir— y la acción de servidor, que es la que de verdad decide.
 * El cliente puede saltarse cualquier validación: una acción de servidor es un
 * endpoint HTTP y se puede invocar a mano.
 */

/**
 * Cuántas opciones tiene la escala con la que se registra HOY.
 *
 * Los registros anteriores llevan la suya en `mood_entries.mood_scale`, y no
 * se convierten: un 3 en la escala de cinco era «Normal» y en la de cuatro es
 * «Bien». Ver la migración `20260919100001_diario_escala_4`.
 */
export const ESCALA_ACTUAL = 4;

/**
 * Límite de la nota. **No es nuevo**: la acción ya cortaba en 5.000, pero lo
 * hacía en silencio, así que quien escribía de más perdía el final sin
 * enterarse. Ahora el mismo número se enseña en un contador, se rechaza con
 * aviso y lo sostiene una restricción de la tabla.
 */
export const LIMITE_NOTA = 5000;

export type RegistroValidado = { valor: number; nota: string | null };

/**
 * Valida lo que llega del cliente. Devuelve el registro ya normalizado o el
 * motivo del rechazo, en español y mostrable.
 *
 * No recorta: si la nota se pasa del límite se rechaza. Recortar es decidir
 * por el paciente qué parte de lo que escribió sobra.
 */
export function validarRegistro(
  valor: unknown,
  nota: unknown,
): { ok: true; registro: RegistroValidado } | { ok: false; error: string } {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 1 || valor > ESCALA_ACTUAL) {
    return { ok: false, error: "Elige cómo te sientes antes de guardar." };
  }

  if (nota != null && typeof nota !== "string") {
    return { ok: false, error: "La nota no es válida." };
  }

  const limpia = typeof nota === "string" ? nota.trim() : "";
  if (limpia.length > LIMITE_NOTA) {
    return {
      ok: false,
      error: `La nota no puede pasar de ${LIMITE_NOTA.toLocaleString("es-ES")} caracteres.`,
    };
  }

  return { ok: true, registro: { valor, nota: limpia || null } };
}

/* ===========================================================================
 * Etiquetas
 *
 * Viven aquí y no en la app del paciente porque las lee también la ficha del
 * profesional. Son descripciones del propio paciente sobre cómo se siente, no
 * una lectura clínica: la aplicación registra y muestra, no interpreta.
 *
 * NINGUNA función acepta un valor suelto: siempre va con su escala, que es la
 * columna `mood_scale` de la fila. Un 3 es «Normal» en la escala de cinco y
 * «Bien» en la de cuatro, así que un valor sin escala no se puede traducir, y
 * fingir que sí es reescribir lo que dijo una persona.
 * ======================================================================== */


const ETIQUETAS: Record<number, Record<number, string>> = {
  4: { 1: "Mal", 2: "Regular", 3: "Bien", 4: "Muy bien" },
  5: { 1: "Muy mal", 2: "Mal", 3: "Normal", 4: "Bien", 5: "Muy bien" },
};

/** Opciones de la escala vigente, en el orden en que se presentan. */
export const OPCIONES_ACTUALES = Object.keys(ETIQUETAS[ESCALA_ACTUAL]!)
  .map(Number)
  .sort((a, b) => a - b)
  .map((valor) => ({ valor, etiqueta: ETIQUETAS[ESCALA_ACTUAL]![valor]! }));

export function escalaConocida(escala: number): boolean {
  return escala in ETIQUETAS;
}

export function esEscalaActual(escala: number): boolean {
  return escala === ESCALA_ACTUAL;
}

/**
 * Etiqueta de un registro. Si la escala no se reconoce se devuelve el crudo
 * `valor/escala` en vez de inventar una palabra: preferible que se vea raro a
 * que afirme algo que no se sabe.
 */
export function etiquetaAnimo(valor: number, escala: number): string {
  return ETIQUETAS[escala]?.[valor] ?? `${valor}/${escala}`;
}

/**
 * Nombre accesible de una opción del selector. Incluye la posición porque el
 * icono por sí solo no dice en qué punto de la escala está.
 */
export function nombreAccesible(valor: number, escala: number): string {
  return `${etiquetaAnimo(valor, escala)}, ${valor} de ${escala}`;
}
