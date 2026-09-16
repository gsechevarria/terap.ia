import type { Metadata } from "next";
import { Building2, Info } from "lucide-react";
import { getContextoPropio } from "@/lib/queries/contexts";
import { getInvitacionesEquipo, getMiembros } from "@/lib/queries/organizations";
import { EquipoPanel } from "@/app/pro/_components/EquipoPanel";

export const metadata: Metadata = { title: "Equipo · terap.ia" };

/**
 * Equipo del centro.
 *
 * La página ENSEÑA según el rol, pero quien decide es el servidor: cada
 * operación pasa por una función `SECURITY DEFINER` que vuelve a comprobar la
 * membresía y el rol. Ocultar un botón no autoriza nada.
 */
export default async function EquipoPage() {
  const contexto = await getContextoPropio();

  if (!contexto?.organization_id) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="page-title">Equipo</h1>
        <p className="empty mt-6">
          Tu cuenta no está asociada a ninguna organización activa.
        </p>
      </div>
    );
  }

  const puedeGestionar =
    contexto.organization_role === "owner" || contexto.organization_role === "admin";

  const [miembros, invitaciones] = await Promise.all([
    getMiembros(contexto.organization_id),
    puedeGestionar ? getInvitacionesEquipo(contexto.organization_id) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="section-label">
          {contexto.organization_kind === "center" ? "Centro" : "Consulta"}
        </p>
        <h1 className="page-title flex items-center gap-3">
          <Building2 size={22} strokeWidth={1.75} aria-hidden className="text-ink-3" />
          {contexto.organization_name}
        </h1>
      </header>

      {/* La separación entre permiso administrativo y acceso clínico es la
          regla menos intuitiva del modelo, así que se dice en la pantalla. */}
      <p className="alert-clinical border-line bg-info-soft">
        <Info size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-info" />
        <span>
          Formar parte del equipo <strong>no da acceso a ningún expediente</strong>.
          El acceso se concede expediente a expediente, desde la ficha de cada
          paciente, por quien ya lo atiende.
        </span>
      </p>

      <EquipoPanel
        organizationId={contexto.organization_id}
        miembros={miembros}
        invitaciones={invitaciones}
        puedeGestionar={puedeGestionar}
        esPropietario={contexto.organization_role === "owner"}
        miProfessionalId={contexto.professional_id}
      />
    </div>
  );
}
