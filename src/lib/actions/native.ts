"use server";

import { createClient } from "@/lib/supabase/server";

/** Guarda (upsert) el token de push nativo del dispositivo. */
export async function saveNativePushTokenAction(
  platform: "ios" | "android",
  token: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  const { error } = await supabase
    .from("device_push_tokens")
    .upsert(
      { user_id: user.id, platform, token },
      { onConflict: "user_id,token" },
    );
  if (error) throw new Error(error.message);
}
