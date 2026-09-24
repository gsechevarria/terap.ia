import { allRows, checked } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";

/**
 * Contextos de trabajo de la cuenta actual.
 *
 * El encargo pide expresamente que una cuenta pueda pertenecer a varias
 * organizaciones y actuar como profesional en una y como paciente en otra, sin
 * un rol global excluyente. Aquí se resuelve QUÉ contextos tiene de verdad,
 * leyendo los datos —membresías y expedientes— y no la metadata.
 *
 * Todo pasa por la RLS: estas consultas solo pueden devolver lo del propio
 * usuario. Ninguna de ellas usa `service_role`.
 */

export type ContextoProfesional = {
  tipo: "professional";
  organizationId: string;
  organizationName: string;
  organizationKind: "solo" | "center";
  role: "owner" | "admin" | "member";
};

export type ContextoPaciente = {
  tipo: "patient";
  patientId: string;
  organizationId: string;
  organizationName: string;
};

export type Contexto = ContextoProfesional | ContextoPaciente;

/** Perfil profesional propio, incluso si aún está pendiente de revisión. */
export type ContextoPropio = {
  professional_id: string | null;
  full_name: string | null;
  verification_status: "pending" | "approved" | "rejected" | "provisional" | null;
  verification_note: string | null;
  verification_source: "manual" | "registro" | null;
  /** Veredicto y motivo de la última consulta al registro del colegio. */
  verification_check_verdict: string | null;
  verification_check_detail: string | null;
  practice_kind: "solo" | "center" | null;
  colegio: string | null;
  numero_colegiado: string | null;
  organization_id: string | null;
  organization_name: string | null;
  organization_kind: "solo" | "center" | null;
  organization_role: "owner" | "admin" | "member" | null;
  access_status: "pending" | "beta" | "suspended" | null;
};

/**
 * Perfil y organización propios.
 *
 * Va por RPC y no por consulta directa porque un profesional PENDIENTE todavía
 * no tiene identidad para la RLS: `current_professional_id()` exige el rol ya
 * concedido. Sin esto no podría ni ver en qué estado está su solicitud.
 */
export async function getContextoPropio(): Promise<ContextoPropio | null> {
  const supabase = await createClient();
  const { data } = await checked(supabase.rpc("my_professional_context"));
  if (!data) return null;
  const c = data as unknown as ContextoPropio;
  return c.professional_id ? c : null;
}

/** Organizaciones donde la cuenta es profesional con membresía activa. */
export async function getContextosProfesionales(): Promise<ContextoProfesional[]> {
  const supabase = await createClient();
  const { data } = await allRows(
    supabase
      .from("organization_members")
      .select("role, organization_id, organizations(name, kind)")
      .eq("status", "active"),
  );
  return (data ?? []).map((m) => {
    const o = m.organizations as unknown as { name: string; kind: "solo" | "center" } | null;
    return {
      tipo: "professional" as const,
      organizationId: m.organization_id,
      organizationName: o?.name ?? "Consulta",
      organizationKind: o?.kind ?? "solo",
      role: m.role,
    };
  });
}

/**
 * Expedientes de la cuenta, uno por centro. Se listan por separado y NUNCA se
 * fusionan: son historias clínicas distintas en organizaciones distintas.
 */
export async function getContextosPaciente(): Promise<ContextoPaciente[]> {
  const supabase = await createClient();
  const { data } = await allRows(
    supabase
      .from("patients")
      .select("id, organization_id, organizations(name)")
      .eq("status", "active"),
  );
  return (data ?? []).map((p) => {
    const o = p.organizations as unknown as { name: string } | null;
    return {
      tipo: "patient" as const,
      patientId: p.id,
      organizationId: p.organization_id,
      organizationName: o?.name ?? "Tu profesional",
    };
  });
}

/**
 * Todos los contextos disponibles. Si hay más de uno, la aplicación pide elegir
 * en vez de decidir por su cuenta cuál es "el bueno".
 */
export async function getContextos(): Promise<Contexto[]> {
  const [pro, pac] = await Promise.all([
    getContextosProfesionales(),
    getContextosPaciente(),
  ]);
  return [...pro, ...pac];
}

/** ¿Es administrador de plataforma? Lo decide el servidor, nunca el cliente. */
export async function esAdminPlataforma(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await checked(supabase.rpc("is_platform_admin"));
  return data === true;
}
