/**
 * Comparación de nombres contra un registro de colegiados.
 *
 * El registro escribe «MONTSERRAT ABAD ABAD»; el profesional, «Montserrat Abad
 * Abad», «Abad Abad, Montserrat» o «Montserrat Abad-Abad». Se comparan como
 * CONJUNTO DE PALABRAS, sin tildes, sin mayúsculas, sin signos y sin partículas
 * («de», «del», «la»…), porque el orden y esas partículas cambian de un sitio a
 * otro sin cambiar a la persona.
 *
 * Lo que NO se hace, a propósito: aceptar que falte una palabra. «Montserrat
 * Abad» no coincide con «MONTSERRAT ABAD ABAD». Esta comparación decide una
 * aprobación automática, y aflojarla es lo que la convertiría en un colador; si
 * no coincide, el alta pasa a revisión de una persona, que es barato.
 */

const PARTICULAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "Y", "I", "E", "DA", "DO", "DAS", "DOS"]);

/** «Abad-Abad, Montserrat» → ["ABAD", "ABAD", "MONTSERRAT"] (ordenado). */
export function palabrasDelNombre(nombre: string): string[] {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-ZÑÇ]+/g, " ")
    .split(" ")
    .filter((p) => p.length > 0 && !PARTICULAS.has(p))
    .sort();
}

/** Mismas palabras, las mismas veces, en cualquier orden. */
export function nombresCoinciden(a: string, b: string): boolean {
  const pa = palabrasDelNombre(a);
  const pb = palabrasDelNombre(b);
  return pa.length > 0 && pa.length === pb.length && pa.every((p, i) => p === pb[i]);
}
