import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, getUserRole } from "@/lib/auth/roles";
import { SignOutForm } from "@/components/SignOutForm";
import { Brandmark } from "@/components/ui/Brandmark";
import { ProNav, ProNavMobile } from "@/app/pro/_components/ProNav";

function Brand() {
  return (
    <Link href="/pro" className="inline-flex shrink-0 items-center">
      <Brandmark size={24} />
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

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Sidebar (escritorio) */}
      <aside className="hidden shrink-0 border-r border-line bg-panel md:block md:w-56">
        <div className="sticky top-0 flex h-screen flex-col gap-4 p-3">
          <div className="px-1.5 pt-1">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto">
            <ProNav />
          </div>
          <div className="border-t border-line px-1.5 pt-3">
            <p className="mb-1.5 truncate text-xs text-ink-3" title={user.email}>
              {user.email}
            </p>
            <SignOutForm />
          </div>
        </div>
      </aside>

      {/* Barra superior (móvil) */}
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <Brand />
          <SignOutForm />
        </div>
        <div className="px-2 pb-2">
          <ProNavMobile />
        </div>
      </header>

      {/* Contenido */}
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
