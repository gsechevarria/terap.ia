"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { createClient } from "@/lib/supabase/server";

/** Guarda (upsert) el token de push nativo del dispositivo. */
async function saveNativePushTokenActionImpl(
  platform: "ios" | "android",
  token: string,
) {
  if (process.env.NEXT_PUBLIC_NATIVE_PUSH_ENABLED !== "true") throw new ActionInputError("Las notificaciones nativas aún no están disponibles.");
  if (!["ios", "android"].includes(platform) || !token || token.length > 4096) throw new ActionInputError("Dispositivo no válido.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ActionInputError("No autenticado.");
  const { error } = await supabase
    .from("device_push_tokens")
    .upsert(
      { user_id: user.id, platform, token },
      { onConflict: "token" },
    );
  if (error) throw new Error(error.message);
}

export async function saveNativePushTokenAction(...args: Parameters<typeof saveNativePushTokenActionImpl>) { return runAction(() => saveNativePushTokenActionImpl(...args)); }
