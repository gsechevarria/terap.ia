import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./PasswordForm";

/**
 * Establecer o cambiar la contraseña. Requiere sesión: se llega logueado
 * (desde Ajustes) o a través del enlace de recuperación
 * (/auth/confirm?type=recovery → next=/account/password).
 */
export default async function AccountPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">
          Tu contraseña
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Establece la contraseña para <b>{user.email}</b>. La usarás junto a tu
          correo para entrar.
        </p>
        <PasswordForm />
      </div>
    </main>
  );
}
