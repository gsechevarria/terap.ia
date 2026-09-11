"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { isAllowedPushEndpoint } from "@/lib/push-safety";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Guarda (upsert) la suscripción Web Push del dispositivo actual. */
async function savePushSubscriptionActionImpl(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  if (!isAllowedPushEndpoint(sub.endpoint) || !/^[A-Za-z0-9_-]{87}=?$/.test(sub.p256dh) || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(sub.auth)) throw new ActionInputError("Suscripción push no válida.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ActionInputError("No autenticado.");
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
async function deletePushSubscriptionActionImpl(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ActionInputError("No autenticado.");

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

async function savePreferencesActionImpl(prefs: NotificationPrefs) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ActionInputError("No autenticado.");
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id,
      appointment_reminders: prefs.appointment_reminders === true,
      new_appointment: prefs.new_appointment === true, new_task: prefs.new_task === true,
      new_scale: prefs.new_scale === true, email_fallback: false,
    });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings");
  revalidatePath("/pro/ajustes");
}

export async function savePushSubscriptionAction(...args: Parameters<typeof savePushSubscriptionActionImpl>) { return runAction(() => savePushSubscriptionActionImpl(...args)); }

export async function deletePushSubscriptionAction(...args: Parameters<typeof deletePushSubscriptionActionImpl>) { return runAction(() => deletePushSubscriptionActionImpl(...args)); }

export async function savePreferencesAction(...args: Parameters<typeof savePreferencesActionImpl>) { return runAction(() => savePreferencesActionImpl(...args)); }
