import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esAdminPlataforma } from "@/lib/queries/contexts";
import { Brandmark } from "@/components/ui/Brandmark";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata: Metadata = {
  title: "Administración · terap.ia",
  robots: { index: false, follow: false },
};

/**
 * Puerta de la administración de plataforma. El proxy manda aquí a quien pide
 * `/admin` sin sesión.
 *
 * Quien ya tiene sesión de administrador pasa directo; cualquier otra sesión ve
 * el formulario, porque puede querer entrar con otra cuenta. La autorización
 * NO vive aquí: vive en `/admin` y en cada RPC.
 *
 * Pantalla de entrada: va siempre en claro (`pantalla-acceso`), como `/login`.
 */
export default async function AdminLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && (await esAdminPlataforma())) redirect("/admin");

  return (
    <main className="pantalla-acceso relative flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="inline-flex items-center" aria-label="terap.ia, ir al inicio">
        <Brandmark height={96} />
      </Link>
      <AdminLoginForm />
      <p className="text-center text-[13px] text-ink-3">
        ¿Buscas tu consulta?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Acceso de profesionales y pacientes
        </Link>
      </p>
    </main>
  );
}
