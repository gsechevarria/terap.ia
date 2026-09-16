"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { enviarCorreo } from "@/lib/email/enviar";
import { invitacionProfesional } from "@/lib/email/plantillas";
import { urlDeInvitacionProfesional } from "@/lib/urls";

/*
 * Registro profesional, equipo del centro y asignación de expedientes.
 *
 * Ni una sola de estas acciones decide permisos por su cuenta: todas llaman a
 * una función `SECURITY DEFINER` que vuelve a comprobar en la base quién eres,
 * a qué organización perteneces y con qué rol. Lo que llegue del navegador
 * —identificadores, roles, casillas— es una PETICIÓN, nunca una autorización.
 */

// --- Registro ---------------------------------------------------------------

export type DatosRegistro = {
  fullName: string;
  practiceKind: "solo" | "center";
  orgName?: string;
  colegio?: string;
  numeroColegiado?: string;
};

/**
 * Alta profesional. Idempotente: reintentarla tras una interrupción actualiza
 * el mismo perfil y la misma organización, sin duplicar ninguno.
 *
 * NO concede el rol operativo. La cuenta queda en `professional_pending` hasta
 * que un administrador de plataforma apruebe la acreditación.
 */
async function registrarProfesionalImpl(datos: DatosRegistro) {
  const nombre = datos.fullName.trim();
  if (nombre.length < 2) throw new ActionInputError("Escribe tu nombre completo.");
  if (datos.practiceKind !== "solo" && datos.practiceKind !== "center") {
    throw new ActionInputError("Elige si trabajas por tu cuenta o en un centro.");
  }
  if (datos.practiceKind === "center" && !datos.orgName?.trim()) {
    throw new ActionInputError("Escribe el nombre del centro.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_professional", {
    p_full_name: nombre,
    p_practice_kind: datos.practiceKind,
    p_org_name: datos.orgName?.trim() || null,
    p_colegio: datos.colegio?.trim() || null,
    p_numero_colegiado: datos.numeroColegiado?.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/registro/estado");
}

// --- Equipo del centro ------------------------------------------------------

async function invitarProfesionalImpl(
  organizationId: string,
  email: string,
  rol: "admin" | "member",
  puedeInvitarPacientes: boolean,
) {
  const destino = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
    throw new ActionInputError("Ese correo no parece válido.");
  }
  // `owner` no se ofrece desde aquí: la propiedad se transfiere aparte, y la
  // RPC lo rechazaría igualmente si quien invita no es propietario.
  if (rol !== "admin" && rol !== "member") {
    throw new ActionInputError("Permiso no válido.");
  }

  const supabase = await createClient();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: invitacionId, error } = await supabase.rpc("issue_professional_invitation", {
    p_org: organizationId,
    p_email: destino,
    p_token_hash: tokenHash,
    p_role: rol,
    p_can_invite: puedeInvitarPacientes,
  });
  if (error) throw new Error(error.message);

  const { data: previa } = await supabase.rpc("professional_invitation_preview", {
    p_token: token,
  });
  const fila = Array.isArray(previa) ? previa[0] : null;
  if (!fila) throw new Error("La invitación se creó pero no se pudo leer para enviarla.");

  const plantilla = invitacionProfesional({
    organizacion: fila.organization_name,
    url: urlDeInvitacionProfesional(token),
    expiraEn: fila.expires_at,
    rol,
  });

  const envio = await enviarCorreo({
    para: destino,
    asunto: plantilla.asunto,
    html: plantilla.html,
    texto: plantilla.texto,
    plantilla: "invitacion_profesional",
    sujeto: { tipo: "professional_invitation", id: String(invitacionId) },
    organizationId,
    payload: { organizacion: fila.organization_name, rol, expires_at: fila.expires_at },
  });

  revalidatePath("/pro/equipo");
  return {
    url: urlDeInvitacionProfesional(token),
    expiresAt: fila.expires_at,
    destinatario: destino,
    correo: envio.estado,
  };
}

async function revocarInvitacionProfesionalImpl(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_professional_invitation", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/pro/equipo");
}

async function cambiarPermisosMiembroImpl(
  memberId: string,
  rol: "owner" | "admin" | "member",
  puedeInvitarPacientes: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_permissions", {
    p_member_id: memberId,
    p_role: rol,
    p_can_invite: puedeInvitarPacientes,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/pro/equipo");
}

async function revocarMiembroImpl(memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_member", { p_member_id: memberId });
  if (error) throw new Error(error.message);
  revalidatePath("/pro/equipo");
  revalidatePath("/pro");
}

// --- Asignación de expedientes ----------------------------------------------

async function asignarExpedienteImpl(patientId: string, professionalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_patient", {
    p_patient_id: patientId,
    p_professional_id: professionalId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

async function retirarExpedienteImpl(patientId: string, professionalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unassign_patient", {
    p_patient_id: patientId,
    p_professional_id: professionalId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pro/patients/${patientId}`);
}

// --- Aceptación de la invitación a un centro --------------------------------

async function aceptarInvitacionProfesionalImpl(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_professional_invitation", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/pro");
  return data as string;
}

export async function registrarProfesionalAction(...a: Parameters<typeof registrarProfesionalImpl>) {
  return runAction(() => registrarProfesionalImpl(...a));
}
export async function invitarProfesionalAction(...a: Parameters<typeof invitarProfesionalImpl>) {
  return runAction(() => invitarProfesionalImpl(...a));
}
export async function revocarInvitacionProfesionalAction(...a: Parameters<typeof revocarInvitacionProfesionalImpl>) {
  return runAction(() => revocarInvitacionProfesionalImpl(...a));
}
export async function cambiarPermisosMiembroAction(...a: Parameters<typeof cambiarPermisosMiembroImpl>) {
  return runAction(() => cambiarPermisosMiembroImpl(...a));
}
export async function revocarMiembroAction(...a: Parameters<typeof revocarMiembroImpl>) {
  return runAction(() => revocarMiembroImpl(...a));
}
export async function asignarExpedienteAction(...a: Parameters<typeof asignarExpedienteImpl>) {
  return runAction(() => asignarExpedienteImpl(...a));
}
export async function retirarExpedienteAction(...a: Parameters<typeof retirarExpedienteImpl>) {
  return runAction(() => retirarExpedienteImpl(...a));
}
export async function aceptarInvitacionProfesionalAction(...a: Parameters<typeof aceptarInvitacionProfesionalImpl>) {
  return runAction(() => aceptarInvitacionProfesionalImpl(...a));
}
