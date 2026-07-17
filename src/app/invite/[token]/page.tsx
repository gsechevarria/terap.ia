import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invitation_preview", { p_token: token });
  const preview = data?.[0] ?? null;

  const valid = preview?.valid === true;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-black/[.08] bg-white p-8 text-center shadow-sm dark:border-white/[.12] dark:bg-neutral-900">
        {!preview ? (
          <>
            <h1 className="text-xl font-semibold">Invitación no encontrada</h1>
            <p className="mt-2 text-sm text-neutral-500">
              El enlace no es válido. Pide a tu profesional que te envíe uno nuevo.
            </p>
          </>
        ) : valid ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              Te han invitado a terap.ia
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              {preview.professional_name
                ? `${preview.professional_name} quiere acompañarte en terap.ia.`
                : "Tu profesional quiere acompañarte en terap.ia."}{" "}
              Válida hasta {formatDate(preview.expires_at)}.
            </p>
            <Link
              href={`/login?invite=${token}`}
              className="mt-6 inline-flex rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Acceder para aceptar
            </Link>
            <p className="mt-3 text-xs text-neutral-400">
              Recibirás un enlace por correo; ábrelo en este dispositivo para
              completar tu alta.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Invitación caducada</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Este enlace ya se usó o ha caducado. Pide uno nuevo a tu profesional.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
