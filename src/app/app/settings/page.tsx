import Link from "next/link";
import { ArrowLeft, ChevronRight, KeyRound } from "lucide-react";
import { getMyPreferences } from "@/lib/queries/notifications";
import { PushToggle } from "@/components/PushToggle";
import { NotificationPreferences } from "@/components/NotificationPreferences";

export const metadata = { title: "Notificaciones · terap.ia" };

export default async function PatientSettingsPage() {
  const prefs = await getMyPreferences();

  return (
    <>
      <Link href="/app/more" className="tp-back">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        Más
      </Link>

      <div className="tp-page-heading">
        <p className="tp-overline">Avisos</p>
        <div>
          <h1 className="tp-h1">Notificaciones</h1>
        </div>
      </div>

      {/* `PushToggle` y `NotificationPreferences` los comparte el panel del
          profesional: se usan tal cual y toman la piel de la app del paciente
          desde `_ui/patient.css`. Su comportamiento no cambia. */}
      <section aria-labelledby="tp-push">
        <div className="tp-section-heading">
          <h2 className="tp-h2" id="tp-push">
            En este dispositivo
          </h2>
        </div>
        <p className="tp-section-desc">
          Activa los avisos para enterarte de tus citas y tareas sin abrir la
          aplicación.
        </p>
        <div style={{ marginTop: 16 }}>
          <PushToggle />
        </div>
      </section>

      <section className="tp-space-top" aria-labelledby="tp-que-recibir">
        <div className="tp-section-heading">
          <h2 className="tp-h2" id="tp-que-recibir">
            ¿Qué quieres recibir?
          </h2>
        </div>
        <div style={{ marginTop: 16 }}>
          <NotificationPreferences initial={prefs} />
        </div>
      </section>

      <section className="tp-space-top" aria-labelledby="tp-cuenta">
        <div className="tp-section-heading">
          <h2 className="tp-h2" id="tp-cuenta">
            Cuenta
          </h2>
        </div>
        <div className="tp-card" style={{ marginTop: 16 }}>
          <Link href="/account/password" className="tp-list-row">
            <KeyRound size={18} strokeWidth={1.7} aria-hidden />
            <span className="tp-list-label">Establecer o cambiar contraseña</span>
            <ChevronRight
              size={17}
              strokeWidth={1.8}
              aria-hidden
              className="tp-chevron"
            />
          </Link>
        </div>
      </section>
    </>
  );
}
