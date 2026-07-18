import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, getUserRole } from "@/lib/auth/roles";
import { SignOutForm } from "@/components/SignOutForm";
import { ServiceWorkerRegister } from "@/app/app/_components/ServiceWorkerRegister";
import { NativeGate } from "@/app/app/_components/NativeGate";

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
    <NativeGate>
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-2">
          <Link
            href="/app"
            className="inline-flex items-baseline gap-1 text-[15px] font-semibold tracking-[-0.01em] text-ink"
          >
            terap.ia
            <span aria-hidden className="size-1.5 self-center rounded-full bg-accent" />
          </Link>
          <div className="flex items-center gap-1.5">
            <a
              href="tel:024"
              className="inline-flex h-7 items-center rounded bg-danger px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Emergencia · 024
            </a>
            <Link
              href="/app/settings"
              className="btn-subtle h-7 px-2 text-xs"
              aria-label="Ajustes"
            >
              Ajustes
            </Link>
            <SignOutForm />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>
      <ServiceWorkerRegister />
    </div>
    </NativeGate>
  );
}
