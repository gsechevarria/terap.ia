import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, UserRoundX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Brandmark } from "@/components/ui/Brandmark";
import { SignOutForm } from "@/components/SignOutForm";
import { formatDateTime } from "@/lib/format";
import { getContextoPropio } from "@/lib/queries/contexts";
import { AceptarEquipoForm } from "./AceptarEquipoForm";

export const metadata: Metadata = {
  title: "Unirte a un centro · terap.ia",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

const ROL: Record<string, string> = {
  owner: "propietario",
  admin: "administrador",
  member: "profesional",
};

/**
 * Incorporación de un profesional a un centro existente.
 *
 * Añade una MEMBRESÍA a esa organización: no crea otro centro, ni duplica el
 * perfil, ni toca los expedientes. El acceso clínico sigue llegando expediente
 * a expediente, por asignación.
 *
 * Abrir el enlace no consume el token; se canjea al pulsar aceptar.
 */
export default async function UnirsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("professional_invitation_preview", { p_token: token });
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
          El enlace no es válido, ha caducado o ya se ha usado. Pide al centro
          que te envíe uno nuevo.
        </p>
      </Marco>
    );
  }

  const sesionCorrecta =
    user?.email && user.email.toLowerCase() === previa.email.toLowerCase();
  const contexto = sesionCorrecta ? await getContextoPropio() : null;

  return (
    <Marco>
      <p className="section-label">Te invitan a un equipo</p>
      <h1 className="page-title">{previa.organization_name}</h1>
      <p className="text-sm leading-relaxed text-ink-2">
        Te incorporarías como{" "}
        <strong className="font-medium text-ink">{ROL[previa.role] ?? previa.role}</strong>.
        Los expedientes a los que tengas acceso se te asignan uno a uno: entrar
        en el equipo no abre ninguno.
      </p>
      <p className="text-xs text-ink-3">
        Válida hasta {formatDateTime(previa.expires_at)}. Un solo uso.
      </p>

      {!user ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
            La invitación es para{" "}
            <strong className="font-medium text-ink">{previa.email}</strong>.
            Solo esa dirección puede aceptarla.
          </p>
          <Link href="/login" className="btn-primary btn-lg">
            Iniciar sesión
          </Link>
          <Link href="/registro" className="btn-ghost">
            No tengo cuenta en Terap
          </Link>
        </div>
      ) : !sesionCorrecta ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm text-ink">
            <UserRoundX className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden />
            <span>
              Esta invitación es para{" "}
              <strong className="font-medium">{previa.email}</strong>, pero has
              entrado como <strong className="font-medium">{user.email}</strong>.
            </span>
          </p>
          <SignOutForm />
        </div>
      ) : !contexto?.professional_id ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl bg-info-soft px-4 py-3 text-sm text-ink">
            Antes de unirte a un centro tienes que completar tu alta
            profesional. Es rápido y no perderás esta invitación.
          </p>
          <Link href="/registro" className="btn-primary btn-lg">
            Completar mi alta
          </Link>
        </div>
      ) : (
        <>
          <AceptarEquipoForm token={token} centro={previa.organization_name} />
          {contexto.verification_status === "pending" && (
            <p className="text-xs leading-relaxed text-ink-3">
              Tu acreditación sigue en revisión. Puedes unirte al equipo ahora,
              pero no abrirás expedientes hasta que se apruebe.
            </p>
          )}
        </>
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
