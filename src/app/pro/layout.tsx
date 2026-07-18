import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, getUserRole } from "@/lib/auth/roles";
import { SignOutForm } from "@/components/SignOutForm";
import { ProNav } from "@/app/pro/_components/ProNav";

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
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/pro"
              className="inline-flex shrink-0 items-baseline gap-1 text-[15px] font-semibold tracking-[-0.01em] text-ink"
            >
              terap.ia
              <span
                aria-hidden
                className="size-1.5 self-center rounded-full bg-accent"
              />
            </Link>
            <ProNav />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-ink-3 md:inline">
              {user.email}
            </span>
            <SignOutForm />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
