"use server";

import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Un alta profesional a medias vuelve a empezar DESDE CERO (decisión de
 * Gabriel, 25-sep-2026).
 *
 * El problema de partida: un `signUp` sobre un correo que ya tiene cuenta
 * confirmada no envía nada y no da error —a propósito, para no revelar qué
 * correos existen—, así que quien abandonó el alta y lo intentaba de nuevo se
 * quedaba esperando un correo que no llegaba.
 *
 * Aquí se borra esa cuenta, y el formulario repite el `signUp`: cuenta nueva,
 * correo de confirmación nuevo. Solo se borra lo que devuelve
 * `incomplete_signup_user_id`, que exige una cuenta SIN NADA —ni ficha
 * profesional, ni expediente, ni rol profesional, ni administración—, así que
 * no se pierde ningún dato.
 *
 * Límite aceptado: quien escriba ese correo en el formulario reinicia esa alta
 * a medias. No da acceso a nada ni borra ningún dato; la persona solo tendría
 * que volver a confirmar su correo.
 */
async function reiniciarAltaIncompletaImpl(correo: string): Promise<boolean> {
  const email = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ActionInputError("Ese correo no parece válido.");
  }
  const admin = createAdminClient();
  const { data: id, error } = await admin.rpc("incomplete_signup_user_id", { p_email: email });
  if (error) throw new Error(error.message);
  if (!id) return false;
  const borrado = await admin.auth.admin.deleteUser(id);
  if (borrado.error) throw new Error(borrado.error.message);
  return true;
}

export async function reiniciarAltaIncompletaAction(
  ...a: Parameters<typeof reiniciarAltaIncompletaImpl>
) {
  return runAction(() => reiniciarAltaIncompletaImpl(...a));
}
