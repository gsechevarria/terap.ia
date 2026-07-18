import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, getUserRole } from "@/lib/auth/roles";
import { SignOutForm } from "@/components/SignOutForm";

/**
 * Layout del panel profesional. Verificación de autorización definitiva
 * (el proxy solo hace redirección optimista).
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
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-3 dark:border-white/[.12]">
        <div className="flex items-center gap-4">
          <span className="font-semibold">terap.ia</span>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/pro" className="text-neutral-600 hover:underline dark:text-neutral-300">
              Pacientes
            </Link>
            <Link href="/pro/agenda" className="text-neutral-600 hover:underline dark:text-neutral-300">
              Agenda
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-500 sm:inline">{user.email}</span>
          <SignOutForm />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
