import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/query-result";
import { esAdminPlataforma } from "@/lib/queries/contexts";
import { ColaAcreditaciones } from "./ColaAcreditaciones";
import { AccesoComercial } from "./AccesoComercial";

export const metadata: Metadata = {
  title: "Administración · terap.ia",
  robots: { index: false, follow: false },
};

/**
 * Administración de plataforma.
 *
 * La comprobación es EN SERVIDOR y se hace dos veces: aquí, para no renderizar
 * nada, y otra vez dentro de cada RPC, que es la que de verdad manda. Si no
 * eres administrador esto devuelve 404 y no 403: un 403 confirmaría que la
 * ruta existe.
 *
 * `platform_admins` nace vacía y no se puede escribir desde la aplicación. El
 * alta del primer administrador se hace fuera de banda:
 * `node scripts/alta-admin-plataforma.mjs <correo>`.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  if (!(await esAdminPlataforma())) notFound();

  const [{ data: profesionales }, { data: organizaciones }] = await Promise.all(
    [
      allRows(
        supabase
          .from("professionals")
          .select(
            "id, full_name, email, verification_status, colegio, numero_colegiado, practice_kind, verification_note, verification_reviewed_at, created_at"
          )
          .in("verification_status", ["pending", "provisional", "rejected"])
          .order("created_at", { ascending: true })
      ),
      allRows(
        supabase
          .from("organizations")
          .select(
            "id, name, kind, created_at, organization_access(status, granted_at, expires_at, note)"
          )
          .order("created_at", { ascending: false })
          .limit(200)
      ),
    ]
  );

  const pendientes = (profesionales ?? []).length;
  const orgs = (organizaciones ?? []).length;

  // Fuera del armazón del panel, pero con su misma hoja: blanca, radio 14,
  // sobre el lienzo. Título y frase como en «Hoy», y las dos colas en dos
  // columnas en vez de una detrás de otra.
  return (
    <div className="flex flex-1 flex-col p-0 lg:p-3">
      <main className="flex flex-1 flex-col gap-[22px] bg-surface px-4 py-[30px] sm:px-8 lg:rounded-4xl">
        <header>
          <h1 className="page-title">Administración de plataforma</h1>
          <p className="mt-3 max-w-[640px] text-body-lg text-ink-2">
            {pendientes === 0
              ? "No hay acreditaciones por revisar"
              : `${pendientes} ${
                  pendientes === 1
                    ? "acreditación por revisar"
                    : "acreditaciones por revisar"
                }`}
            {` y ${orgs} ${orgs === 1 ? "organización" : "organizaciones"}. `}
            Desde aquí no se ve ningún expediente: un administrador de
            plataforma no está asignado a ninguno, y la RLS se lo negaría igual.
          </p>
        </header>

        <div className="flex flex-col gap-8 lg:flex-row">
          <ColaAcreditaciones
            profesionales={(profesionales ?? []).map((p) => ({
              id: p.id,
              nombre: p.full_name,
              email: p.email,
              estado: p.verification_status,
              colegio: p.colegio,
              numeroColegiado: p.numero_colegiado,
              tipo: p.practice_kind,
              nota: p.verification_note,
              creado: p.created_at,
            }))}
          />

          <AccesoComercial
            organizaciones={(organizaciones ?? []).map((o) => {
              const a = o.organization_access as unknown as {
                status: "pending" | "beta" | "suspended";
                granted_at: string | null;
                expires_at: string | null;
                note: string | null;
              } | null;
              return {
                id: o.id,
                nombre: o.name,
                tipo: o.kind,
                estado: a?.status ?? "pending",
                concedido: a?.granted_at ?? null,
                caduca: a?.expires_at ?? null,
                nota: a?.note ?? null,
              };
            })}
          />
        </div>
      </main>
    </div>
  );
}
