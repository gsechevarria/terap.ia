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
  // `invitation_preview` es accesible a `anon` (esta landing es pública), así
  // que desde 20260807120002 devuelve 0 filas para cualquier token que no esté
  // vivo y ya no revela el nombre del profesional: para alguien anónimo, el
  // psicólogo asociado a un destinatario es un dato de salud por inferencia.
  // Por eso aquí solo hay dos estados: sirve o no sirve.
  const { data } = await supabase.rpc("invitation_preview", { p_token: token });
  const preview = data?.[0] ?? null;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 text-center">
        {preview ? (
          <>
            <h1 className="text-xl font-semibold tracking-[-0.01em]">
              Te han invitado a terap.ia
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              Tu profesional quiere acompañarte en terap.ia. Válida hasta{" "}
              {formatDate(preview.expires_at)}.
            </p>
            <Link
              href={`/login?invite=${token}`}
              className="btn-primary mt-6 h-9 px-5"
            >
              Acceder para aceptar
            </Link>
            <p className="mt-3 text-xs text-ink-3">
              Usa el mismo correo en el que has recibido la invitación: solo esa
              dirección puede aceptarla. Recibirás un enlace y tendrás que
              abrirlo en este dispositivo.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-[-0.01em]">
              Esta invitación ya no sirve
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              El enlace no es válido, ha caducado o ya se ha usado. Pide a tu
              profesional que te envíe uno nuevo.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
