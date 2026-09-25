import { ServiceWorkerRegister } from "@/app/app/_components/ServiceWorkerRegister";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ROLES, getUserRole } from "@/lib/auth/roles";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MarcaTerap } from "@/components/ui/MarcaTerap";
import { ProNav } from "@/app/pro/_components/ProNav";
import { CajonNavegacion } from "@/app/pro/_components/CajonNavegacion";
import { BuscadorCabecera } from "@/app/pro/_components/BuscadorCabecera";
import { SidebarPerfil } from "@/app/pro/_components/SidebarPerfil";
import { countPendingRequests } from "@/lib/queries/appointment-requests";
import { countActivePatients } from "@/lib/queries/patients";
import { countAvisosAbiertos } from "@/lib/queries/scales";
import { esCuentaAdminPlataforma, getContextoPropio } from "@/lib/queries/contexts";
import { formatFechaLarga } from "@/lib/format";

/** Marca de Terap, la de la portada (`MarcaTerap`). Lleva a «Hoy». */
function Marca() {
  return (
    <Link href="/pro" className="inline-flex shrink-0 items-center text-ink" aria-label="Terap, ir a Hoy">
      <MarcaTerap tamano={21} />
    </Link>
  );
}

/**
 * Layout del panel profesional: el shell de toda el área.
 *
 * Verificación de autorización definitiva (el proxy solo hace redirección
 * optimista).
 *
 * Anatomía, de fuera adentro: lienzo `--canvas` → barra lateral de 236 px
 * DIRECTAMENTE sobre el lienzo, sin panel ni borde → hoja blanca de radio 14
 * con 12 px de margen (0 por la izquierda, que ya lo pone la barra) → cabecera
 * de 60 px → contenido. La hoja es lo único blanco de la pantalla, y por eso se
 * lee como una hoja.
 *
 * Por debajo de 1024 px la barra lateral pasa a cajón y la hoja ocupa todo el
 * ancho, sin margen ni radio: en un móvil, un margen de 12 px alrededor de todo
 * es ancho de contenido que se pierde.
 */
export default async function ProLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const role = getUserRole(user);
  if (role === ROLES.PATIENT) redirect("/app");
  if (role !== ROLES.PROFESSIONAL) redirect("/login?error=sin-rol");

  // Lo que el paciente ha pedido y espera respuesta, y los avisos de ítem de
  // riesgo sin revisar: visibles desde cualquier pantalla, porque una solicitud
  // sin contestar es una cita que no se agenda y un aviso sin ver es lo único
  // de esta aplicación que no puede esperar. Los cuatro son independientes
  // entre sí: en secuencia serían cuatro viajes.
  const [pendingRequests, patientCount, avisos, contexto, esAdmin] = await Promise.all([
    countPendingRequests(),
    countActivePatients(),
    countAvisosAbiertos(),
    getContextoPropio(),
    // La cuenta, no la sesión: el enlace se enseña aunque falte el segundo
    // factor, que se pide al entrar.
    esCuentaAdminPlataforma(),
  ]);

  // El instante se resuelve en el servidor y se formatea aquí: `formatFechaLarga`
  // fija la zona de Madrid, así que no depende de la del runtime ni de la del
  // navegador y no hay desajuste de hidratación.
  const fechaLarga = formatFechaLarga(new Date().toISOString());

  const pie = (
    <div className="flex flex-col gap-3">
      <ThemeToggle />
      <SidebarPerfil
        nombre={contexto?.full_name ?? null}
        correo={user.email ?? ""}
        organizacion={contexto?.organization_name ?? null}
      />
    </div>
  );

  return (
    <div className="flex min-h-[calc(100dvh-var(--banner-h))] bg-canvas">
      <ServiceWorkerRegister />

      {/* Barra lateral (escritorio): sobre el lienzo, sin panel ni borde. */}
      <aside className="hidden shrink-0 lg:block lg:w-[var(--sidebar-w)]">
        <div className="sticky top-[var(--banner-h)] flex h-[calc(100dvh-var(--banner-h))] flex-col px-3.5 pt-[22px] pb-[18px]">
          <div className="px-2.5 pb-[26px]">
            <Marca />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ProNav
              pendingRequests={pendingRequests}
              patientCount={patientCount}
              esAdmin={esAdmin}
            />
          </div>
          <div className="mt-auto pt-4">{pie}</div>
        </div>
      </aside>

      {/* Hoja de trabajo. */}
      <main className="flex min-w-0 flex-1 flex-col bg-surface lg:my-3 lg:mr-3 lg:rounded-4xl">
        <header className="flex min-h-[60px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <CajonNavegacion
              esAdmin={esAdmin}
              pendingRequests={pendingRequests}
              patientCount={patientCount}
            >
              {pie}
            </CajonNavegacion>
            <span className="truncate text-[13.5px] text-ink-3">{fechaLarga}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <BuscadorCabecera />
            </div>

            {/*
              Señal de avisos. El punto rojo aparece SOLO si hay respuestas con
              ítem de riesgo sin revisar; no es una campana de novedades
              genéricas, porque esta aplicación no tiene buzón de
              notificaciones que consultar. Lleva a «Hoy», que es donde está la
              franja con el detalle y el botón de revisar.
            */}
            <Link
              href="/pro"
              aria-label={
                avisos > 0
                  ? `${avisos} ${avisos === 1 ? "aviso de seguridad sin revisar" : "avisos de seguridad sin revisar"}`
                  : "No hay avisos de seguridad sin revisar"
              }
              className="relative flex size-9 items-center justify-center rounded-xl bg-surface-muted text-ink transition-colors hover:bg-surface-subtle"
            >
              <Bell size={16} strokeWidth={1.8} aria-hidden />
              {avisos > 0 && (
                <span
                  aria-hidden
                  className="absolute top-2 right-2.5 size-[7px] rounded-full bg-danger"
                />
              )}
            </Link>

            <Link href="/pro/agenda" className="btn-primary rounded-xl">
              Nueva cita
            </Link>
          </div>
        </header>

        <div className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-[30px]">{children}</div>
      </main>
    </div>
  );
}
