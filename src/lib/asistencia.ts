/*
 * Cuándo se puede registrar la asistencia de una cita.
 *
 * Solo cuando la cita ya ha empezado. Marcar «acudió» en una cita futura la
 * liquidaba por adelantado (consumía bono o creaba un pago pendiente), la
 * pasaba a `completed` —con lo que desaparecía de las dos listas de la ficha:
 * no es «próxima» porque está completada, ni «historial» porque no ha pasado—
 * y habilitaba un justificante de una sesión que aún no había ocurrido.
 *
 * «Pendiente» se puede poner siempre: es como se deshace un registro hecho por
 * error, también el de una cita futura marcada antes de existir esta regla.
 */
export type Asistencia = "pending" | "attended" | "no_show" | "late_cancel";

export const MENSAJE_ASISTENCIA_FUTURA =
  "La asistencia se registra cuando la cita ya ha empezado.";

export function citaEmpezada(startsAtISO: string, ahora: Date = new Date()): boolean {
  const inicio = new Date(startsAtISO).getTime();
  return Number.isFinite(inicio) && inicio <= ahora.getTime();
}

export function puedeRegistrarAsistencia(
  asistencia: Asistencia,
  startsAtISO: string,
  ahora: Date = new Date(),
): boolean {
  return asistencia === "pending" || citaEmpezada(startsAtISO, ahora);
}

/** El justificante exige las dos cosas: que conste «acudió» y que ya haya empezado. */
export function puedeEmitirJustificante(
  cita: { attendance: string; starts_at: string },
  ahora: Date = new Date(),
): boolean {
  return cita.attendance === "attended" && citaEmpezada(cita.starts_at, ahora);
}
