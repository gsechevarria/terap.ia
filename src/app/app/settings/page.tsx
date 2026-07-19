import Link from "next/link";
import { getMyPreferences } from "@/lib/queries/notifications";
import { PushToggle } from "@/components/PushToggle";
import { NotificationPreferences } from "@/components/NotificationPreferences";

export default async function PatientSettingsPage() {
  const prefs = await getMyPreferences();
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <Link href="/app" className="text-sm text-ink-3 hover:text-ink">
          ← Inicio
        </Link>
        <h1 className="page-title mt-3">Ajustes</h1>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="section-label">Notificaciones push</h2>
        <PushToggle />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="section-label">¿Qué quieres recibir?</h2>
        <NotificationPreferences initial={prefs} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="section-label">Cuenta</h2>
        <Link href="/account/password" className="btn-ghost self-start">
          Establecer o cambiar contraseña
        </Link>
      </section>
    </div>
  );
}
