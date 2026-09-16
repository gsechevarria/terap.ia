import { allRows, checked } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
import type { Invitation } from "@/lib/types";

/**
 * Estado del acceso del paciente a Terap, tal y como lo pide el encargo:
 * sin invitar · pendiente · caducada · revocada · acceso vinculado.
 *
 * Se DERIVA de las fechas en vez de guardarse en una columna, porque una
 * columna de estado y tres marcas de tiempo acaban discrepando el día que algo
 * se escribe por un camino que nadie recordaba.
 */
export type EstadoAcceso =
  | "sin_invitar"
  | "pendiente"
  | "caducada"
  | "revocada"
  | "vinculado";

export type AccesoPaciente = {
  estado: EstadoAcceso;
  /** Destinatario de la última invitación emitida. */
  email: string | null;
  enviadaEl: string | null;
  caducaEl: string | null;
  invitationId: string | null;
};

function derivar(inv: Invitation | null, tieneCuenta: boolean): EstadoAcceso {
  if (tieneCuenta) return "vinculado";
  if (!inv) return "sin_invitar";
  if (inv.accepted_at) return "vinculado";
  if (inv.revoked_at) return "revocada";
  return new Date(inv.expires_at).getTime() <= Date.now() ? "caducada" : "pendiente";
}

/** Invitación pendiente (no aceptada, no revocada y no caducada) más reciente. */
export async function getActiveInvitation(
  patientId: string,
): Promise<Invitation | null> {
  const supabase = await createClient();
  const { data } = await checked(
    supabase
      .from("invitations")
      .select("*")
      .eq("patient_id", patientId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  return data ?? null;
}

/**
 * Estado completo para la ficha. Mira la ÚLTIMA invitación emitida, no solo la
 * viva: si caducó o se revocó, el profesional necesita verlo para reenviar.
 */
export async function getAccesoPaciente(
  patientId: string,
  tieneCuenta: boolean,
): Promise<AccesoPaciente> {
  const supabase = await createClient();
  const { data } = await allRows(
    supabase
      .from("invitations")
      .select("id, email, created_at, expires_at, accepted_at, revoked_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1),
  );
  const inv = (data?.[0] ?? null) as Invitation | null;
  return {
    estado: derivar(inv, tieneCuenta),
    email: inv?.email ?? null,
    enviadaEl: inv?.created_at ?? null,
    caducaEl: inv?.expires_at ?? null,
    invitationId: inv?.id ?? null,
  };
}
