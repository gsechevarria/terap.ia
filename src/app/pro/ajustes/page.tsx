import { getMyPreferences } from "@/lib/queries/notifications";
import { PushToggle } from "@/components/PushToggle";
import { NotificationPreferences } from "@/components/NotificationPreferences";

export default async function ProSettingsPage() {
  const prefs = await getMyPreferences();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Notificaciones</h1>

      <section className="mt-5 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-500">
          Notificaciones push
        </h2>
        <PushToggle />
      </section>

      <section className="mt-6 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-500">
          ¿Qué quieres recibir?
        </h2>
        <NotificationPreferences initial={prefs} />
      </section>
    </div>
  );
}
