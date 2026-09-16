import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, CircleCheck, CircleX, ShieldQuestion } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Brandmark } from "@/components/ui/Brandmark";
import { SignOutForm } from "@/components/SignOutForm";
import { getContextoPropio } from "@/lib/queries/contexts";

export const metadata: Metadata = { title: "Estado de tu alta · terap.ia" };

/**
 * Estado de la solicitud profesional.
 *
 * Mientras esté pendiente, esto es TODO lo que ve la cuenta. No es una
 * restricción cosmética: sin el rol concedido, la RLS tampoco le devolvería un
 * solo expediente aunque llegara al panel por la URL.
 *
 * Aquí NUNCA pone "profesional verificado" salvo que la acreditación esté
 * realmente aprobada.
 */
export default async function EstadoRegistroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const contexto = await getContextoPropio();
  if (!contexto?.professional_id) redirect("/registro");

  const estado = contexto.verification_status;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 py-10">
      <Brandmark height={48} />

      {estado === "approved" ? (
        <Bloque
          Icono={CircleCheck}
          tono="success"
          titulo="Tu cuenta está activa"
          texto="Tu acreditación ha sido aprobada. Ya puedes trabajar con expedientes e invitar pacientes."
        >
          <Link href="/pro" className="btn-primary btn-lg self-start">
            Entrar al panel
          </Link>
        </Bloque>
      ) : estado === "rejected" ? (
        <Bloque
          Icono={CircleX}
          tono="danger"
          titulo="No hemos podido aprobar tu alta"
          texto={
            contexto.verification_note ??
            "La revisión no ha salido adelante. Si crees que es un error, responde al correo de soporte."
          }
        />
      ) : estado === "provisional" ? (
        <Bloque
          Icono={ShieldQuestion}
          tono="warn"
          titulo="Tu cuenta funciona, pendiente de revisar la acreditación"
          texto="Puedes trabajar con normalidad. Tu colegiación está en la cola de revisión; hasta que se compruebe, tu perfil no aparece como verificado."
        >
          <Link href="/pro" className="btn-primary btn-lg self-start">
            Entrar al panel
          </Link>
        </Bloque>
      ) : (
        <Bloque
          Icono={Clock}
          tono="info"
          titulo="Tu solicitud está en revisión"
          texto="Una persona revisa los datos de colegiación antes de habilitar la cuenta. Te avisaremos por correo en cuanto esté."
        >
          <p className="text-xs leading-relaxed text-ink-3">
            Mientras tanto no puedes abrir expedientes ni invitar pacientes.
            Confirmar tu correo no acredita la colegiación: son cosas distintas
            y esta es la segunda.
          </p>
        </Bloque>
      )}

      <dl className="card flex flex-col gap-3 p-5 text-sm">
        <Dato termino="Cuenta" valor={user.email ?? "—"} />
        <Dato termino="Nombre" valor={contexto.full_name ?? "—"} />
        <Dato
          termino={contexto.organization_kind === "center" ? "Centro" : "Consulta"}
          valor={contexto.organization_name ?? "—"}
        />
        {contexto.colegio && <Dato termino="Colegio" valor={contexto.colegio} />}
        {contexto.numero_colegiado && (
          <Dato termino="Nº colegiado" valor={contexto.numero_colegiado} />
        )}
      </dl>

      <div className="flex items-center justify-between gap-3">
        <Link href="/registro" className="text-sm text-ink-3 hover:text-ink">
          Corregir mis datos
        </Link>
        <SignOutForm />
      </div>
    </main>
  );
}

function Bloque({
  Icono,
  tono,
  titulo,
  texto,
  children,
}: {
  Icono: typeof Clock;
  tono: "info" | "success" | "warn" | "danger";
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  const fondo = {
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
  }[tono];
  return (
    <section className="card flex flex-col gap-4 p-6">
      <span className={`grid size-11 place-items-center rounded-2xl ${fondo}`}>
        <Icono size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="page-title">{titulo}</h1>
      <p className="text-sm leading-relaxed text-ink-2">{texto}</p>
      {children}
    </section>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-ink-3">{termino}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{valor}</dd>
    </div>
  );
}
