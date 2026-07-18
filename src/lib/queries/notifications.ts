import { createClient } from "@/lib/supabase/server";
import type { NotificationPrefs } from "@/lib/actions/notifications";

export const DEFAULT_PREFS: NotificationPrefs = {
  appointment_reminders: true,
  new_appointment: true,
  new_task: true,
  new_scale: true,
  email_fallback: true,
};

/** Preferencias de notificación del usuario actual (o valores por defecto). */
export async function getMyPreferences(): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFS;
  const { data } = await supabase
    .from("notification_preferences")
    .select(
      "appointment_reminders, new_appointment, new_task, new_scale, email_fallback",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  return data ?? DEFAULT_PREFS;
}
