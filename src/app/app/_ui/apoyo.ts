/**
 * Mensajes de apoyo del diario emocional.
 *
 * Un único fichero, tipado y corto **a propósito**: son las frases que lee una
 * persona que acaba de decir que está mal, y tienen que poder revisarse de una
 * pasada por alguien que no lea TypeScript.
 *
 * ---------------------------------------------------------------------------
 * QUÉ ES ESTO Y QUÉ NO
 *
 * Es una respuesta fija a la opción que ha pulsado el paciente. Nada más.
 *
 *  · NO analiza la nota. El texto libre no se lee, no se clasifica y no entra
 *    en esta decisión.
 *  · NO hay modelo de lenguaje, ni servicio externo, ni heurística.
 *  · NO es una intervención clínica, ni un consejo, ni una detección de riesgo.
 *    Elegir «Mal» no avisa a nadie: el circuito de riesgo sigue siendo el ítem
 *    9 del PHQ-9 y el 024 de la cabecera, que no se tocan.
 *
 * Es la diferencia entre acompañar y diagnosticar, y es la que mantiene la
 * aplicación fuera del reglamento de producto sanitario.
 * ---------------------------------------------------------------------------
 *
 * Reglas de redacción, comprobadas por `src/lib/apoyo.test.ts`:
 *
 *  · Nada que prometa que todo mejorará.
 *  · Nada que minimice el malestar.
 *  · Nada que culpabilice.
 *  · Nada que recomiende un tratamiento.
 *  · Nada que dé a entender que hay alguien mirando el registro en directo.
 *  · Sin rachas, puntos ni premios: el diario no es una competición y sentirse
 *    bien no es la respuesta correcta.
 */

/** Mensajes por valor, dentro de la escala de cuatro opciones. */
const APOYO: Readonly<Record<number, readonly string[]>> = {
  // 1 · Mal
  1: [
    "No tienes que resolverlo todo hoy.",
    "Puedes darte espacio para reconocer cómo te sientes.",
    "Si hoy cuesta, puedes ir poco a poco.",
  ],
  // 2 · Regular
  2: [
    "No todos los días tienen que sentirse igual.",
    "Puedes tomarte el día a tu ritmo.",
    "Este espacio también es para los días difíciles de explicar.",
  ],
};

/**
 * Confirmación tras guardar. **La misma para las cuatro opciones**, y eso es
 * deliberado: felicitar un «Muy bien» convertiría el diario en algo que se
 * puede hacer bien o mal, y dejaría al que marcó «Mal» habiéndolo hecho peor.
 */
export const CONFIRMACION_GUARDADO = "Guardado. Gracias por contarlo.";

/**
 * Semilla estable → índice estable.
 *
 * El mensaje **no puede cambiar mientras el paciente escribe**, ni al volver a
 * renderizar, ni al reintentar un guardado que falló. Con un aleatorio por
 * render, cada pulsación de tecla le cambiaría la frase debajo del texto, que
 * es exactamente lo contrario de acompañar.
 *
 * Se resuelve sin estado: el índice se DERIVA del día. Así es el mismo en
 * Inicio y en Diario, sobrevive a recargas y a desmontajes, y cambia de un día
 * para otro para que no sea siempre la misma frase.
 */
function indice(semilla: string, total: number): number {
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) | 0;
  return Math.abs(h) % total;
}

/**
 * Mensaje de apoyo para una opción, o `null` si esa opción no lleva ninguno.
 *
 * Solo «Mal» y «Regular» lo tienen, y se muestra **antes de guardar**, en
 * cuanto se pulsa: si alguien entra, marca que está mal y se va sin guardar,
 * ya ha leído algo.
 *
 * @param valor   Opción elegida (1-4).
 * @param escala  Escala de esa opción. Una escala que no sea la vigente no
 *                recibe mensaje: sus números significan otra cosa.
 * @param dia     'YYYY-MM-DD' del registro, como semilla estable.
 */
export function mensajeDeApoyo(
  valor: number,
  escala: number,
  dia: string,
): string | null {
  if (escala !== 4) return null;
  const opciones = APOYO[valor];
  if (!opciones || opciones.length === 0) return null;
  return opciones[indice(dia, opciones.length)]!;
}

/** Todas las frases del catálogo, para revisarlas de una vez. */
export function todosLosMensajes(): string[] {
  return [...Object.values(APOYO).flat(), CONFIRMACION_GUARDADO];
}
