import { allRows } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";

/** Miembros del equipo, con el estado de acreditación de cada uno. */
export type Miembro = {
  id: string;
  professionalId: string;
  nombre: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
  canInvitePatients: boolean;
  verificacion: "pending" | "approved" | "rejected" | "provisional" | null;
  desde: string;
};

export type InvitacionEquipo = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  canInvitePatients: boolean;
  expiresAt: string;
  createdAt: string;
};

/**
 * Equipo de una organización.
 *
 * La RLS ya limita esto a organizaciones donde el llamante es miembro; aquí no
 * se vuelve a filtrar por confianza, se filtra porque la página muestra una
 * sola organización a la vez.
 */
export async function getMiembros(organizationId: string): Promise<Miembro[]> {
  const supabase = await createClient();
  const { data } = await allRows(
    supabase
      .from("organization_members")
      .select(
        "id, professional_id, role, can_invite_patients, created_at, professionals(full_name, email, verification_status)",
      )
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
  );
  return (data ?? []).map((m) => {
    const p = m.professionals as unknown as {
      full_name: string | null;
      email: string | null;
      verification_status: Miembro["verificacion"];
    } | null;
    return {
      id: m.id,
      professionalId: m.professional_id,
      nombre: p?.full_name ?? null,
      email: p?.email ?? null,
      role: m.role,
      canInvitePatients: m.can_invite_patients,
      verificacion: p?.verification_status ?? null,
      desde: m.created_at,
    };
  });
}

/** Invitaciones de equipo aún vivas. Las caducadas no se listan como abiertas. */
export async function getInvitacionesEquipo(
  organizationId: string,
): Promise<InvitacionEquipo[]> {
  const supabase = await createClient();
  const { data } = await allRows(
    supabase
      .from("professional_invitations")
      .select("id, email, role, can_invite_patients, expires_at, created_at")
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  );
  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    canInvitePatients: i.can_invite_patients,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));
}

/** Profesionales asignados a un expediente. */
export async function getAsignaciones(patientId: string) {
  const supabase = await createClient();
  const { data } = await allRows(
    supabase
      .from("patient_assignments")
      .select("id, professional_id, role, created_at, professionals(full_name)")
      .eq("patient_id", patientId)
      .is("revoked_at", null)
      .order("created_at", { ascending: true }),
  );
  return (data ?? []).map((a) => {
    const p = a.professionals as unknown as { full_name: string | null } | null;
    return {
      id: a.id,
      professionalId: a.professional_id,
      nombre: p?.full_name ?? "Profesional",
      role: a.role as "primary" | "collaborator",
      desde: a.created_at,
    };
  });
}
