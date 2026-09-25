import type { Metadata } from "next";
import { Info } from "lucide-react";
import { getContextoPropio } from "@/lib/queries/contexts";
import { getInvitacionesEquipo, getMiembros } from "@/lib/queries/organizations";
import { EquipoPanel } from "@/app/pro/_components/EquipoPanel";

export const metadata: Metadata = { title: "Equipo · Terap" };

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
      <div>
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

  const tipo = contexto.organization_kind === "center" ? "Centro" : "Consulta";
  const personas = `${miembros.length} ${miembros.length === 1 ? "persona" : "personas"}`;
  const frase = `${tipo} ${contexto.organization_name ?? ""}: ${personas} en el equipo${
    puedeGestionar && invitaciones.length > 0
      ? ` y ${invitaciones.length} ${invitaciones.length === 1 ? "invitación pendiente" : "invitaciones pendientes"}`
      : ""
  }.`;

  // Cabecera como la de «Hoy»: título y una frase. El nombre del centro va en
  // la frase, no como título con una etiqueta encima, que era la única
  // pantalla del panel que lo hacía al revés.
  return (
    <div className="flex flex-col gap-[22px]">
      <header>
        <h1 className="page-title">Equipo</h1>
        <p className="mt-3 max-w-[600px] text-body-lg text-ink-2">{frase}</p>
      </header>

      {/* La separación entre permiso administrativo y acceso clínico es la
          regla menos intuitiva del modelo, así que se dice en la pantalla.
          Franja y no tarjeta: cruza el ancho y se lee antes que la tabla. */}
      <p className="flex items-start gap-2.5 rounded-md border border-line bg-info-soft px-4 py-3 text-[13.5px] text-ink-2">
        <Info size={17} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-info" />
        <span>
          Formar parte del equipo{" "}
          <strong className="font-semibold text-ink">
            no da acceso a ningún expediente
          </strong>
          . El acceso se concede expediente a expediente, desde la ficha de cada
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
