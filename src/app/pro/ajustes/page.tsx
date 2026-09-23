import Link from "next/link";
import { getMyPreferences } from "@/lib/queries/notifications";
import { PushToggle } from "@/components/PushToggle";
import { NotificationPreferences } from "@/components/NotificationPreferences";

/**
 * Ajustes del profesional.
 *
 * `PushToggle` y `NotificationPreferences` los comparte con la app del paciente,
 * que vuelve a pintarlos al final de `app/_ui/patient.css`. Aquí se envuelven,
 * nunca se tocan por dentro: cambiar su marcado repintaría la otra aplicación.
 */
export default async function ProSettingsPage() {
  const prefs = await getMyPreferences();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-7">
      <h1 className="page-title">Ajustes</h1>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Notificaciones push</h2>
        <PushToggle />
      </section>

      {/* Las zonas se separan con una línea y aire, no con más cajas. */}
      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 className="section-title">¿Qué quieres recibir?</h2>
        <NotificationPreferences initial={prefs} />
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 className="section-title">Cuenta</h2>
        <Link href="/account/password" className="btn-ghost self-start">
          Establecer o cambiar contraseña
        </Link>
      </section>
    </div>
  );
}
