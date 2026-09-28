import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Brandmark } from "@/components/ui/Brandmark";
import { getContextoPropio } from "@/lib/queries/contexts";
import { DatosProfesionalesForm } from "../DatosProfesionalesForm";

export const metadata: Metadata = { title: "Corregir tus datos · Terap" };

/**
 * Corregir los datos del alta mientras está en revisión.
 *
 * `/registro` manda a su estado a quien ya tiene ficha profesional, así que el
 * «Corregir mis datos» de allí volvía a la misma pantalla. Aquí se reabre el
 * mismo formulario con lo guardado: `register_professional` actualiza el
 * perfil y la organización sin duplicarlos, y la acción vuelve a consultar el
 * registro del colegio.
 *
 * Solo con la solicitud pendiente. Aprobada, la función ya no cambia nombre,
 * colegio ni número, y el formulario mentiría; rechazada, la decisión es de
 * una persona y no se reabre desde aquí.
 */
export default async function CorregirRegistroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const contexto = await getContextoPropio();
  if (!contexto?.professional_id) redirect("/registro");
  if (contexto.verification_status !== "pending") redirect("/registro/estado");

  const tipo = contexto.organization_kind ?? contexto.practice_kind ?? "solo";

  return (
    <main className="pantalla-acceso mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 py-10">
      <Link
        href="/registro/estado"
        className="inline-flex items-center gap-2 text-[13px] text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        Volver al estado de tu alta
      </Link>

      <div className="flex flex-col gap-3">
        <Brandmark height={48} />
        <h1 className="page-title">Corrige tus datos</h1>
        <p className="text-body-lg text-ink-2">
          Al guardar volvemos a comprobarlos. Tu solicitud sigue siendo la
          misma: no se crea otra cuenta ni otra consulta.
        </p>
      </div>

      <DatosProfesionalesForm
        nombreSugerido={contexto.full_name ?? ""}
        inicial={{
          tipo,
          centro: tipo === "center" ? (contexto.organization_name ?? "") : "",
          colegio: contexto.colegio ?? "",
          numero: contexto.numero_colegiado ?? "",
        }}
        textoEnviar="Guardar y volver a comprobar"
      />
    </main>
  );
}
