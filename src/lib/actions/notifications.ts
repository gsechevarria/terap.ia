"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Guarda (upsert) la suscripción Web Push del dispositivo actual. */
export async function savePushSubscriptionAction(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

/**
 * Da de baja la suscripción push de este dispositivo.
 *
 * El filtro por `user_id` es la corrección: borraba por `endpoint` sin
 * comprobar sesión ni propietario, así que quien conociera (o adivinara por
 * fuerza bruta) el endpoint de otra persona podía dejarla sin notificaciones.
 */
export async function deletePushSubscriptionAction(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export type NotificationPrefs = {
  appointment_reminders: boolean;
  new_appointment: boolean;
  new_task: boolean;
  new_scale: boolean;
  email_fallback: boolean;
};

export async function savePreferencesAction(prefs: NotificationPrefs) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, ...prefs });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
  revalidatePath("/pro/ajustes");
}
