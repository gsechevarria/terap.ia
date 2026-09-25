import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleAlert, ShieldCheck, UserRoundX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Brandmark } from "@/components/ui/Brandmark";
import { SignOutForm } from "@/components/SignOutForm";
import { formatDateTime } from "@/lib/format";

/**
 * `no-referrer` no es adorno: el token va en el path, y sin esto la cabecera
 * `Referer` lo entregaría a cualquier recurso externo que cargara la página.
 * Por eso tampoco hay aquí ni un script de analítica ni una fuente remota.
 */
export const metadata: Metadata = {
  title: "Tu invitación · Terap",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/**
 * Pantalla de la invitación del paciente.
 *
 * ABRIR ESTA URL NO CONSUME NADA. Los antivirus de correo visitan los enlaces
 * automáticamente, así que consumir el token al abrirlo dejaría al paciente
 * con una invitación gastada que nunca usó. El token se canja al aceptar
 * explícitamente, en `/onboarding`, junto con el consentimiento.
 *
 * Lo que se enseña antes de identificarse es el NOMBRE DEL CENTRO y nada más:
 * ni el del profesional, ni una palabra del expediente.
 */
export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("invitation_preview", { p_token: token });
  const previa = (Array.isArray(data) ? data[0] : null) ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!previa) {
    return (
      <Marco>
        <span className="grid size-11 place-items-center rounded-2xl bg-warn-soft text-warn">
          <CircleAlert size={22} strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="page-title">Esta invitación ya no sirve</h1>
        <p className="text-sm leading-relaxed text-ink-2">
          El enlace no es válido, ha caducado o ya se ha usado. Pídele a tu
          profesional que te envíe uno nuevo.
        </p>
        <Link href="/acceso/paciente" className="btn-ghost self-start">
          Más información
        </Link>
      </Marco>
    );
  }

  const destinatario = previa.email ?? "";
  const sesionCorrecta =
    user?.email && destinatario &&
    user.email.toLowerCase() === destinatario.toLowerCase();

  return (
    <Marco>
      <p className="section-label">Te han invitado a Terap</p>
      <h1 className="page-title">{previa.organization_name}</h1>
      <p className="text-sm leading-relaxed text-ink-2">
        Podrás ver tus citas, escribir en tu diario y responder lo que te pida
        tu profesional. Nadie más ve tu espacio.
      </p>
      <p className="text-xs text-ink-3">
        Válida hasta {formatDateTime(previa.expires_at)}. Un solo uso.
      </p>

      {!user ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
            La invitación es para{" "}
            <strong className="font-medium text-ink">{destinatario}</strong>.
            Solo esa dirección puede aceptarla.
          </p>
          <Link href={`/login?invite=${encodeURIComponent(token)}`} className="btn-primary btn-lg">
            Continuar
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </Link>
          <p className="text-xs leading-relaxed text-ink-3">
            Si ya tienes cuenta en Terap, entra con ella: no se creará ninguna
            nueva y tus otros centros no se mezclan con este.
          </p>
        </div>
      ) : sesionCorrecta ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-ink">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} aria-hidden />
            Has entrado como <strong className="font-medium">{user.email}</strong>.
          </p>
          <Link href={`/onboarding/${encodeURIComponent(token)}`} className="btn-primary btn-lg">
            Revisar y aceptar
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </Link>
          <p className="text-xs leading-relaxed text-ink-3">
            En el siguiente paso leerás el consentimiento y lo aceptarás. Hasta
            entonces no se vincula nada.
          </p>
        </div>
      ) : (
        // Sesión abierta con OTRA cuenta. No se cambia el destinatario en
        // silencio: se explica y se ofrece salir.
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm text-ink">
            <UserRoundX className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden />
            <span>
              Esta invitación es para{" "}
              <strong className="font-medium">{destinatario}</strong>, pero has
              entrado como <strong className="font-medium">{user.email}</strong>.
              Cierra la sesión y entra con la cuenta invitada.
            </span>
          </p>
          <SignOutForm />
        </div>
      )}
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="pantalla-acceso mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-10">
      <Brandmark height={52} />
      <div className="card flex flex-col gap-4 p-6">{children}</div>
    </main>
  );
}
