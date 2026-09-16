import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Brandmark } from "@/components/ui/Brandmark";
import { getContextoPropio } from "@/lib/queries/contexts";
import { CrearCuentaForm } from "./CrearCuentaForm";
import { DatosProfesionalesForm } from "./DatosProfesionalesForm";

export const metadata: Metadata = { title: "Alta profesional · terap.ia" };

/**
 * Alta profesional, en tres pasos y sin inventarse ninguno:
 *
 *   1. Cuenta y credenciales — con el proveedor de autenticación que ya usa la
 *      aplicación (Supabase Auth). No se sustituye por nada nuevo.
 *   2. Verificación del correo — la hace el propio proveedor. Verificar el
 *      correo NO verifica la acreditación profesional, y la pantalla lo dice.
 *   3. Datos profesionales y tipo de consulta — crea la organización.
 *
 * Después, revisión manual. Hasta que un administrador apruebe, la cuenta
 * puede ver su estado y nada más.
 */
export default async function RegistroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ya registrado: a su estado, que es donde está la información útil.
  if (user) {
    const contexto = await getContextoPropio();
    if (contexto?.professional_id) redirect("/registro/estado");
  }

  const correoVerificado = Boolean(user?.email_confirmed_at);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 py-10">
      <Link href="/acceso" className="inline-flex items-center gap-2 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        Volver
      </Link>

      <div className="flex flex-col gap-3">
        <Brandmark height={48} />
        <h1 className="page-title">Crea tu espacio en Terap</h1>
        <p className="text-sm leading-relaxed text-ink-2">
          Para una consulta individual o para un centro con varios
          profesionales.
        </p>
      </div>

      <ol className="flex items-center gap-2 text-label-sm" aria-label="Pasos del alta">
        <Paso n={1} texto="Cuenta" hecho={Boolean(user)} activo={!user} />
        <Paso n={2} texto="Correo" hecho={correoVerificado} activo={Boolean(user) && !correoVerificado} />
        <Paso n={3} texto="Tu consulta" hecho={false} activo={correoVerificado} />
      </ol>

      {!user ? (
        <CrearCuentaForm />
      ) : !correoVerificado ? (
        <div className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">Confirma tu correo</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            Te hemos enviado un enlace a <strong className="text-ink">{user.email}</strong>.
            Ábrelo para continuar. Si ya lo has hecho, recarga esta página.
          </p>
          <p className="text-xs text-ink-3">
            Confirmar el correo demuestra que la dirección es tuya. No acredita
            tu colegiación: eso lo revisamos aparte, en el último paso.
          </p>
        </div>
      ) : (
        <DatosProfesionalesForm nombreSugerido={user.user_metadata?.full_name ?? ""} />
      )}
    </main>
  );
}

function Paso({
  n,
  texto,
  hecho,
  activo,
}: {
  n: number;
  texto: string;
  hecho: boolean;
  activo: boolean;
}) {
  return (
    <li className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
          hecho
            ? "bg-accent text-accent-ink"
            : activo
              ? "bg-accent-soft text-accent"
              : "bg-surface-2 text-ink-3"
        }`}
        aria-hidden
      >
        {n}
      </span>
      <span className={`truncate ${activo || hecho ? "text-ink" : "text-ink-3"}`}>{texto}</span>
    </li>
  );
}
