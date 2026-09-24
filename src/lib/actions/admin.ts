"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { esAdminPlataforma } from "@/lib/queries/contexts";

/*
 * Administración de plataforma.
 *
 * Doble comprobación deliberada: aquí se mira `is_platform_admin()` para poder
 * dar un mensaje decente, y la RPC lo vuelve a mirar por su cuenta. La que
 * manda es la segunda — la de la base—, porque es la que no se puede saltar
 * llamando a la API por otro camino.
 */

async function exigirAdmin() {
  if (!(await esAdminPlataforma())) {
    throw new ActionInputError("Esta operación es solo para administración de plataforma.");
  }
}

/**
 * Aprueba o rechaza una acreditación profesional.
 *
 * Aprobar concede el rol operativo; rechazar lo retira. Las dos cosas quedan
 * en `audit_log` con quién y cuándo.
 */
async function revisarProfesionalImpl(
  professionalId: string,
  estado: "approved" | "rejected" | "pending",
  nota?: string,
) {
  await exigirAdmin();
  if (!["approved", "rejected", "pending"].includes(estado)) {
    throw new ActionInputError("Estado de revisión no válido.");
  }
  // Rechazar sin decir por qué deja a alguien sin saber qué corregir.
  if (estado === "rejected" && !nota?.trim()) {
    throw new ActionInputError("Escribe el motivo del rechazo: la persona debe poder verlo.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_professional", {
    p_professional_id: professionalId,
    p_status: estado,
    p_note: nota?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

/**
 * Estado comercial de una organización.
 *
 * NO cobra nada ni crea ninguna suscripción: hoy no hay facturación en el
 * producto. `beta` es una autorización explícita con fecha y responsable.
 */
async function cambiarAccesoOrganizacionImpl(
  organizationId: string,
  estado: "pending" | "beta" | "suspended",
  hasta?: string,
  nota?: string,
) {
  await exigirAdmin();
  if (!["pending", "beta", "suspended"].includes(estado)) {
    throw new ActionInputError("Estado de acceso no válido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_org_access", {
    p_org: organizationId,
    p_status: estado,
    p_expires_at: hasta ? new Date(hasta).toISOString() : null,
    p_note: nota?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function revisarProfesionalAction(...a: Parameters<typeof revisarProfesionalImpl>) {
  return runAction(() => revisarProfesionalImpl(...a));
}
export async function cambiarAccesoOrganizacionAction(...a: Parameters<typeof cambiarAccesoOrganizacionImpl>) {
  return runAction(() => cambiarAccesoOrganizacionImpl(...a));
}

/**
 * Para el acceso de `/admin/login`: tras iniciar sesión, decir si la cuenta
 * administra la plataforma y poder avisar en vez de soltar un 404. No abre
 * nada: `/admin` y cada RPC lo vuelven a comprobar por su cuenta.
 */
async function soyAdminPlataformaImpl(): Promise<boolean> {
  return esAdminPlataforma();
}
export async function soyAdminPlataformaAction() {
  return runAction(() => soyAdminPlataformaImpl());
}
