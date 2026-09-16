import type { Viewport } from "next";
import { hasSignedConsent } from "@/lib/queries/consent";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Brandmark } from "@/components/ui/Brandmark";
import { ROLES, getUserRole } from "@/lib/auth/roles";
import { ServiceWorkerRegister } from "@/app/app/_components/ServiceWorkerRegister";
import { NativeGate } from "@/app/app/_components/NativeGate";
import { AppTabBar } from "@/app/app/_components/AppTabBar";
import { ScrollReset } from "@/app/app/_components/ScrollReset";
import { esAppNativa } from "@/lib/native-request";
import "./_ui/patient.css";

/**
 * `interactiveWidget: "resizes-content"` es lo que hace habitable un armazón de
 * alto fijo con teclado virtual: sin él el teclado tapa el campo enfocado y la
 * barra de pestañas se queda flotando encima, porque el viewport de diseño no
 * se entera de que la pantalla ha menguado. Con él, la zona que desplaza se
 * encoge y el campo queda visible.
 *
 * Se declara aquí, no en el layout raíz: el panel del profesional desplaza la
 * página entera y no lo necesita. Los campos que no define un segmento se
 * heredan del raíz, pero `width` e `initialScale` se repiten explícitamente
 * para no depender de ese detalle de resolución.
 */
export const viewport: Viewport = {
  themeColor: "#f9fafb",
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

/**
 * Layout de la app del paciente (PWA).
 *
 * Verificación de autorización definitiva (el proxy solo redirige de forma
 * optimista) + armazón móvil: cabecera y navegación estables, una sola zona
 * que desplaza, y el 024 sin esconder detrás de ningún menú.
 */
export default async function PatientLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const role = getUserRole(user);
  if (role === ROLES.PROFESSIONAL) redirect("/pro");
  if (role !== ROLES.PATIENT) redirect("/login?error=sin-rol");

  if (!(await hasSignedConsent())) redirect("/onboarding/current");

  const nativo = await esAppNativa();

  return (
    <NativeGate nativo={nativo}>
      <div className="tp-app">
        <div className="tp-shell">
          <header className="tp-header">
            <Link href="/app" className="tp-wordmark" aria-label="terap.ia, inicio">
              <Brandmark height={30} />
            </Link>
            {/* El 024 es el mismo destino verificado que ya usaba la app; la
                maqueta no llamaba a ningún número y aquí no se ha inventado
                ninguno. El detalle (024 y 112) está en `/app/more`. */}
            <a href="tel:024" className="tp-help">
              <span className="tp-help-dot" aria-hidden />
              Ayuda urgente · 024
            </a>
          </header>

          <div className="tp-scroll" id="tp-scroll">
            <main className="tp-screen">{children}</main>
          </div>

          <AppTabBar />
        </div>
        <ScrollReset />
        <ServiceWorkerRegister />
      </div>
    </NativeGate>
  );
}
