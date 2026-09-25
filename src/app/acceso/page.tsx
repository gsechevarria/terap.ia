import type { Metadata } from "next";
import Link from "next/link";
import { LogIn, Stethoscope, UserRound } from "lucide-react";
import { Brandmark } from "@/components/ui/Brandmark";

export const metadata: Metadata = { title: "Entrar en Terap" };

/**
 * Las tres entradas del producto.
 *
 * "Soy paciente" NO abre un alta: no hay registro público de pacientes, y aquí
 * se dice en voz alta en lugar de dejar que alguien rellene un formulario para
 * descubrirlo al final. El expediente lo crea su profesional y el acceso llega
 * por un enlace individual al correo.
 */
export default function AccesoPage() {
  return (
    <main className="pantalla-acceso mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <Link href="/" className="inline-flex items-center">
          <Brandmark height={72} />
        </Link>
        <h1 className="page-title">¿Cómo entras?</h1>
      </div>

      {/* Un solo bloque con tres filas, no tres tarjetas sueltas: son las
          entradas de una misma decisión y lo que las separa es una línea, no
          una caja por cada una. Sin flecha al final de cada fila: la fila
          entera ya es el enlace. */}
      <div className="card divide-y divide-line-soft overflow-hidden">
        <Link href="/registro" className="row-hover flex items-center gap-4 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Stethoscope size={22} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">Soy profesional</span>
            <span className="block text-[13.5px] text-ink-2">
              Crear una consulta o un centro en Terap.
            </span>
          </span>
        </Link>

        <Link href="/acceso/paciente" className="row-hover flex items-center gap-4 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-info-soft text-info">
            <UserRound size={22} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">Soy paciente</span>
            <span className="block text-[13.5px] text-ink-2">
              Activar la invitación que te han enviado.
            </span>
          </span>
        </Link>

        <Link href="/login" className="row-hover flex items-center gap-4 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-muted text-ink-2">
            <LogIn size={22} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">Ya tengo cuenta</span>
            <span className="block text-[13.5px] text-ink-2">Iniciar sesión.</span>
          </span>
        </Link>
      </div>
    </main>
  );
}
