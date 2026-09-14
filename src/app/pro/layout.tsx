import { ServiceWorkerRegister } from "@/app/app/_components/ServiceWorkerRegister";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, getUserRole } from "@/lib/auth/roles";
import { CalendarPlus } from "lucide-react";
import { SignOutForm } from "@/components/SignOutForm";
import { Brandmark } from "@/components/ui/Brandmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ProNav, ProNavMobile } from "@/app/pro/_components/ProNav";
import { SidebarPerfil } from "@/app/pro/_components/SidebarPerfil";
import { countPendingRequests } from "@/lib/queries/appointment-requests";
import { countActivePatients } from "@/lib/queries/patients";
import { getCurrentProfessional } from "@/lib/queries/identity";

function Brand() {
  return (
    <Link href="/pro" className="inline-flex shrink-0 items-center">
      <Brandmark height={132} />
    </Link>
  );
}

/**
 * Layout del panel profesional. Verificación de autorización definitiva
 * (el proxy solo hace redirección optimista). Navegación lateral (sidebar) en
 * escritorio; barra superior con nav horizontal en móvil.
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

  // Lo que el paciente ha pedido y espera respuesta: visible desde cualquier
  // pantalla, porque una solicitud sin contestar es una cita que no se agenda.
  // Los tres son independientes entre sí: en secuencia serían tres viajes.
  const [pendingRequests, patientCount, profesional] = await Promise.all([
    countPendingRequests(),
    countActivePatients(),
    getCurrentProfessional(),
  ]);

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <ServiceWorkerRegister />
      {/* Sidebar (escritorio) */}
      <aside className="hidden shrink-0 border-r border-line bg-surface md:block md:w-60">
        <div className="sticky top-[var(--banner-h)] flex h-[calc(100dvh-var(--banner-h))] flex-col justify-between gap-5 p-4">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="px-1 pt-1">
              <Brand />
            </div>

            {/* Acción destacada: dar cita es lo que más se hace desde aquí. */}
            <Link href="/pro/agenda" className="btn-primary w-full">
              <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
              Nueva cita
            </Link>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <ProNav
                pendingRequests={pendingRequests}
                patientCount={patientCount}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-line pt-3">
            <ThemeToggle />
            <SidebarPerfil nombre={profesional?.full_name ?? null} correo={user.email ?? ""} />
          </div>
        </div>
      </aside>

      {/* Barra superior (móvil) */}
      <header className="sticky top-[var(--banner-h)] z-10 border-b border-line bg-canvas/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <Brand />
          <SignOutForm />
        </div>
        <div className="px-2 pb-2">
          <ProNavMobile pendingRequests={pendingRequests} />
        </div>
      </header>

      {/* Contenido */}
      <main className="min-w-0 flex-1 px-4 py-9 sm:px-9">{children}</main>
    </div>
  );
}
