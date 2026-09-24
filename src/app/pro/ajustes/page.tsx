import Link from "next/link";
import { getMyPreferences } from "@/lib/queries/notifications";
import { getContextoPropio } from "@/lib/queries/contexts";
import { createClient } from "@/lib/supabase/server";
import { PushToggle } from "@/components/PushToggle";
import { NotificationPreferences } from "@/components/NotificationPreferences";

const ROL: Record<string, string> = {
  owner: "propietario",
  admin: "administrador",
  member: "profesional",
};

/**
 * Acreditación, con el mismo criterio que Equipo: `provisional` NUNCA dice
 * «verificada», y el color acompaña a una frase que dice el estado entero.
 */
const ACREDITACION: Record<string, { texto: string; clase: string }> = {
  approved: { texto: "Verificada", clase: "text-success" },
  pending: { texto: "En revisión", clase: "text-info" },
  provisional: { texto: "Sin comprobar", clase: "text-warning-ink" },
  rejected: { texto: "Rechazada", clase: "text-danger" },
};

/**
 * Ajustes del profesional, con el lenguaje de «Hoy»: título y frase, y dos
 * columnas sobre la hoja —avisos a la izquierda, cuenta a la derecha—
 * separadas por aire y líneas, sin cajas. Antes era una columna de 36 rem
 * centrada, con la hoja vacía a los dos lados.
 *
 * `PushToggle` y `NotificationPreferences` los comparte con la app del paciente,
 * que vuelve a pintarlos al final de `app/_ui/patient.css`. Aquí se envuelven,
 * nunca se tocan por dentro: cambiar su marcado repintaría la otra aplicación.
 */
export default async function ProSettingsPage() {
  const supabase = await createClient();
  const [prefs, contexto, { data: auth }] = await Promise.all([
    getMyPreferences(),
    getContextoPropio(),
    supabase.auth.getUser(),
  ]);
  const correo = auth.user?.email ?? null;
  const acred = contexto?.verification_status
    ? ACREDITACION[contexto.verification_status]
    : null;
  const colegiacion = [contexto?.colegio, contexto?.numero_colegiado]
    .filter(Boolean)
    .join(", nº ");

  return (
    <div className="flex flex-col gap-[22px]">
      <header>
        <h1 className="page-title">Ajustes</h1>
        <p className="mt-3 max-w-[600px] text-body-lg text-ink-2">
          Qué avisos recibes en este dispositivo y los datos de tu cuenta.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Avisos */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <section className="flex max-w-xl flex-col gap-3">
            <h2 className="section-title">Notificaciones push</h2>
            <p className="-mt-1 text-[13px] text-ink-3">
              Se activan dispositivo a dispositivo: el ordenador y el móvil van por
              separado.
            </p>
            <PushToggle />
          </section>

          <section className="flex max-w-xl flex-col gap-3 border-t border-line pt-6">
            <h2 className="section-title">¿Qué quieres recibir?</h2>
            <NotificationPreferences initial={prefs} />
          </section>
        </div>

        {/* Cuenta */}
        <section className="w-full lg:w-[400px] lg:shrink-0" aria-labelledby="cuenta">
          <h2 id="cuenta" className="section-title mb-2.5">
            Tu cuenta
          </h2>
          <dl className="border-t border-line text-[13.5px]">
            <Fila rotulo="Nombre" valor={contexto?.full_name ?? "Sin nombre"} />
            <Fila rotulo="Correo" valor={correo ?? "—"} />
            <Fila
              rotulo="Colegiación"
              valor={colegiacion || <span className="text-ink-3">Sin indicar</span>}
            />
            <Fila
              rotulo="Acreditación"
              valor={
                acred ? (
                  <span className={`font-medium ${acred.clase}`}>{acred.texto}</span>
                ) : (
                  "—"
                )
              }
            />
            {contexto?.organization_name && (
              <Fila
                rotulo={contexto.organization_kind === "center" ? "Centro" : "Consulta"}
                valor={
                  <>
                    {contexto.organization_name}
                    {contexto.organization_role && (
                      <span className="block text-[12.5px] font-normal text-ink-3">
                        como {ROL[contexto.organization_role] ?? contexto.organization_role}
                      </span>
                    )}
                  </>
                }
              />
            )}
          </dl>

          <div className="mt-4 flex flex-col items-start gap-2.5">
            <Link href="/account/password" className="btn-ghost">
              Establecer o cambiar contraseña
            </Link>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <Link href="/pro/equipo" className="text-accent hover:underline">
                Equipo
              </Link>
              <Link href="/pro/contabilidad/configuracion" className="text-accent hover:underline">
                Configuración fiscal
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Fila({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2.5"
      style={{ borderBottom: "1px solid var(--line-soft)" }}
    >
      <dt className="shrink-0 text-ink-3">{rotulo}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-ink">{valor}</dd>
    </div>
  );
}
