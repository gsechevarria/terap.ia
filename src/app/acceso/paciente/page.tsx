import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MailQuestion } from "lucide-react";
import { Brandmark } from "@/components/ui/Brandmark";

export const metadata: Metadata = { title: "Acceso de pacientes · terap.ia" };

/**
 * No hay alta pública de pacientes, y esta pantalla existe para decirlo.
 *
 * El expediente lo crea el profesional y el acceso llega por un enlace
 * individual al correo del paciente. Ofrecer aquí un formulario de registro
 * daría a entender que alguien puede darse de alta por su cuenta y acabaría en
 * cuentas huérfanas sin ningún profesional detrás.
 */
export default function AccesoPacientePage() {
  return (
    <main className="pantalla-acceso mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <Link href="/acceso" className="inline-flex items-center gap-2 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        Volver
      </Link>

      <div className="flex flex-col items-center gap-4 text-center">
        <Brandmark height={56} />
        <span className="grid size-12 place-items-center rounded-2xl bg-info-soft text-info">
          <MailQuestion size={24} strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="page-title">Para acceder a Terap, tu profesional debe enviarte una invitación</h1>
        <p className="text-sm leading-relaxed text-ink-2">
          Recibirás un correo con un enlace personal. Ábrelo y podrás crear tu
          cuenta o entrar con la que ya tengas.
        </p>
      </div>

      <div className="card flex flex-col gap-3 p-5 text-sm text-ink-2">
        <p>
          <strong className="font-medium text-ink">¿No te ha llegado?</strong>{" "}
          Revisa la carpeta de correo no deseado y pídele a tu profesional que
          te lo reenvíe: por seguridad, los enlaces caducan a las 48 horas.
        </p>
        <p>
          <strong className="font-medium text-ink">¿Ya lo activaste?</strong>{" "}
          Entonces entra con tu cuenta.
        </p>
        <Link href="/login" className="btn-ghost self-start">
          Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
