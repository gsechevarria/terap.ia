import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, getUserRole } from "@/lib/auth/roles";
import { SignOutForm } from "@/components/SignOutForm";
import { ServiceWorkerRegister } from "@/app/app/_components/ServiceWorkerRegister";

/**
 * Layout de la app del paciente (base de la futura PWA).
 * Verificación de autorización definitiva + botón de emergencia siempre visible.
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-black/[.08] px-4 py-3 dark:border-white/[.12]">
        <span className="font-semibold">terap.ia</span>
        <div className="flex items-center gap-3">
          <a
            href="tel:024"
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Emergencia · 024
          </a>
          <Link
            href="/app/settings"
            className="text-sm text-neutral-500 hover:underline"
            aria-label="Ajustes"
          >
            Ajustes
          </Link>
          <SignOutForm />
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
      <ServiceWorkerRegister />
    </div>
  );
}
