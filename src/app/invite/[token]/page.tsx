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
      <div className="card w-full max-w-md p-8 text-center">
        {!preview ? (
          <>
            <h1 className="text-xl font-semibold tracking-[-0.01em]">
              Invitación no encontrada
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              El enlace no es válido. Pide a tu profesional que te envíe uno
              nuevo.
            </p>
          </>
        ) : valid ? (
          <>
            <h1 className="text-xl font-semibold tracking-[-0.01em]">
              Te han invitado a terap.ia
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              {preview.professional_name
                ? `${preview.professional_name} quiere acompañarte en terap.ia.`
                : "Tu profesional quiere acompañarte en terap.ia."}{" "}
              Válida hasta {formatDate(preview.expires_at)}.
            </p>
            <Link
              href={`/login?invite=${token}`}
              className="btn-primary mt-6 h-9 px-5"
            >
              Acceder para aceptar
            </Link>
            <p className="mt-3 text-xs text-ink-3">
              Recibirás un enlace por correo; ábrelo en este dispositivo para
              completar tu alta.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-[-0.01em]">
              Invitación caducada
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              Este enlace ya se usó o ha caducado. Pide uno nuevo a tu
              profesional.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
