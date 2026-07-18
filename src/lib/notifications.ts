import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

/**
 * Encola una notificación para el usuario (auth.user) de un paciente.
 * La inserta el profesional (RLS: notifications_insert_by_professional).
 * El filtrado por preferencias y el envío ocurren en el cron.
 */
export async function enqueuePatientNotification(
  supabase: Client,
  args: {
    userId: string;
    professionalId: string;
    patientId: string;
    type: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    scheduledFor?: string | null;
  },
): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: args.userId,
    professional_id: args.professionalId,
    patient_id: args.patientId,
    channel: "push",
    type: args.type,
    title: args.title,
    body: args.body,
    payload: (args.payload ?? null) as Json,
    scheduled_for: args.scheduledFor ?? null,
    status: "queued",
  });
}
