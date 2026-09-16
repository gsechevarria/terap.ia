/**
 * Etiquetas de la escala de ánimo 1-5.
 *
 * Vive fuera de `MoodScale.tsx` porque ese es un módulo de cliente y las
 * pantallas de servidor (el diario, el historial) también necesitan el texto:
 * importarlo desde allí lo convertiría en una referencia de cliente que no se
 * puede llamar durante el render del servidor.
 *
 * Son descripciones del propio paciente sobre cómo se siente, no una lectura
 * clínica: la app registra y muestra, no interpreta ni puntúa.
 */
export const ANIMO: Record<number, string> = {
  1: "Muy mal",
  2: "Mal",
  3: "Normal",
  4: "Bien",
  5: "Muy bien",
};

export function etiquetaAnimoTexto(valor: number): string {
  return ANIMO[valor] ?? `${valor}/5`;
}
