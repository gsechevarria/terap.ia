"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";
import { enviarCorreo } from "@/lib/email/enviar";
import { invitacionPaciente } from "@/lib/email/plantillas";
import { urlDeInvitacionPaciente } from "@/lib/urls";

export type ResultadoInvitacion = {
  /** Enlace en claro. Se devuelve UNA vez; en base de datos solo vive su hash. */
  url: string;
  expiresAt: string;
  destinatario: string;
  /** Qué ha pasado con el correo. No se afirma entrega al destinatario. */
  correo: "sent" | "failed" | "no_provider";
};

/**
 * Emite la invitación de acceso de un paciente y manda el correo.
 *
 * El token son 256 bits de `randomBytes`; en base de datos se guarda solo su
 * SHA-256 (`issue_invitation`), así que un volcado no permite canjear nada. El
 * claro se devuelve una vez para construir el enlace y para poder entregarlo a
 * mano si el correo no ha salido.
 *
 * Reemitir REVOCA las invitaciones anteriores que siguieran vivas; de eso se
 * encarga la RPC, en la misma transacción.
 */
async function createInvitationActionImpl(
  patientId: string,
  emailOverride?: string,
): Promise<ResultadoInvitacion> {
  const { patient } = await requireOwnedPatient(patientId);

  const destino = (emailOverride ?? patient.email ?? "").trim();
  if (!destino) {
    throw new ActionInputError(
      "Añade el correo del paciente antes de invitarle: solo esa dirección puede aceptar la invitación.",
    );
  }
  // Comprobación mínima de forma. La de verdad la hace el proveedor al enviar;
  // aquí solo se evita gastar una invitación en algo que no es un correo.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
    throw new ActionInputError("Ese correo no parece válido.");
  }

  const supabase = await createClient();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data, error } = await supabase.rpc("issue_invitation", {
    p_patient_id: patient.id,
    p_token_hash: tokenHash,
    p_email: destino,
  });
  if (error) throw new Error(error.message);

  const fila = Array.isArray(data) ? data[0] : null;
  if (!fila) throw new Error("No se ha podido emitir la invitación.");

  const url = urlDeInvitacionPaciente(token);

  // El nombre del centro sale de la vista previa, que es lo mismo que verá el
  // paciente. Si no se pudiera leer, el correo no se manda a medias.
  const { data: previa } = await supabase.rpc("invitation_preview", { p_token: token });
  const organizacion = (Array.isArray(previa) ? previa[0]?.organization_name : null) ?? "Tu profesional";

  const plantilla = invitacionPaciente({
    organizacion,
    url,
    expiraEn: fila.expires_at,
  });

  const envio = await enviarCorreo({
    para: fila.recipient,
    asunto: plantilla.asunto,
    html: plantilla.html,
    texto: plantilla.texto,
    plantilla: "invitacion_paciente",
    sujeto: { tipo: "invitation", id: fila.invitation_id },
    // Sin nada del expediente: ni nombre del paciente, ni tareas, ni citas.
    payload: { organizacion, expires_at: fila.expires_at },
  });

  revalidatePath(`/pro/patients/${patientId}`);
  return {
    url,
    expiresAt: fila.expires_at,
    destinatario: fila.recipient,
    correo: envio.estado,
  };
}

/** Revoca una invitación aún pendiente. El enlace deja de servir al instante. */
async function revokeInvitationActionImpl(invitationId: string, patientId: string) {
  await requireOwnedPatient(patientId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_id: invitationId });
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

export async function createInvitationAction(...args: Parameters<typeof createInvitationActionImpl>) {
  return runAction(() => createInvitationActionImpl(...args));
}

export async function revokeInvitationAction(...args: Parameters<typeof revokeInvitationActionImpl>) {
  return runAction(() => revokeInvitationActionImpl(...args));
}
