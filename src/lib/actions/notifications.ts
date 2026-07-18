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

export async function deletePushSubscriptionAction(endpoint: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
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
