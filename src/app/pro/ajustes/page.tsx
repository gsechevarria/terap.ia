import Link from "next/link";
import { getMyPreferences } from "@/lib/queries/notifications";
import { PushToggle } from "@/components/PushToggle";
import { NotificationPreferences } from "@/components/NotificationPreferences";

export default async function ProSettingsPage() {
  const prefs = await getMyPreferences();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-title">Ajustes</h1>

      <section className="mt-6 flex flex-col gap-2">
        <h2 className="section-label">Notificaciones push</h2>
        <PushToggle />
      </section>

      <section className="mt-8 flex flex-col gap-2">
        <h2 className="section-label">¿Qué quieres recibir?</h2>
        <NotificationPreferences initial={prefs} />
      </section>

      <section className="mt-8 flex flex-col gap-2">
        <h2 className="section-label">Cuenta</h2>
        <Link href="/account/password" className="btn-ghost self-start">
          Establecer o cambiar contraseña
        </Link>
      </section>
    </div>
  );
}
