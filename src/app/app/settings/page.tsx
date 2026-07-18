import Link from "next/link";
import { getMyPreferences } from "@/lib/queries/notifications";
import { PushToggle } from "@/components/PushToggle";
import { NotificationPreferences } from "@/components/NotificationPreferences";

export default async function PatientSettingsPage() {
  const prefs = await getMyPreferences();
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <Link href="/app" className="text-sm text-neutral-500 hover:underline">
        ← Inicio
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Notificaciones</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-500">
          Notificaciones push
        </h2>
        <PushToggle />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-500">
          ¿Qué quieres recibir?
        </h2>
        <NotificationPreferences initial={prefs} />
      </section>
    </div>
  );
}
