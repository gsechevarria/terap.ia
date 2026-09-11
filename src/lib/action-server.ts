import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ActionInputError, type ActionResult } from "@/lib/action-result";
import { GENERIC_ERROR } from "@/lib/errors";
const SQL_MESSAGES = new Set([
  "Confirma el porcentaje de IVA recuperable", "La respuesta es demasiado larga",
  "Configura una tarifa antes de liquidar la cita", "La cita está cancelada",
  "La cita tiene un cobro registrado: cancélala para conservar el historial",
  "Corrige la cita o archiva el bono; conserva su registro económico",
  "La imputación de bono no se modifica como un cobro", "La retención supera la base",
  "Configura la prorrata de IVA", "Amortización no válida", "Datos fiscales no válidos",
  "La solicitud ya se utilizó con otros datos", "Acepta el consentimiento vigente para continuar",
  // Solicitudes de cita: el paciente necesita saber POR QUÉ no se ha enviado
  // (hora pasada, tope alcanzado…), y el profesional por qué no puede aceptar.
  "Tipo de solicitud no válido", "Indica una fecha y hora",
  "Tienes 3 solicitudes pendientes. Espera a que tu profesional las revise.",
  "Elige una hora con al menos una hora de antelación",
  "Elige una fecha dentro del próximo año",
  "La alternativa debe tener al menos una hora de antelación",
  "Esa cita ya no admite cambios", "Esa solicitud ya no está pendiente",
  "Solo el profesional resuelve solicitudes", "Acción no válida",
  "El horario de la cita no es válido",
  "Ese hueco se solapa con otra cita de tu agenda",
  "Ese hueco cae dentro de un bloqueo de tu agenda",
]);
export async function runAction<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { success: true, data: await work() }; }
  catch (error) {
    unstable_rethrow(error);
    const safe = error instanceof ActionInputError || (error instanceof Error && SQL_MESSAGES.has(error.message));
    return { success: false, error: safe && error instanceof Error ? error.message : GENERIC_ERROR };
  }
}
