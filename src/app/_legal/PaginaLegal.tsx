import Link from "next/link";
import type { ReactNode } from "react";
import { Brandmark } from "@/components/ui/Brandmark";

/**
 * Armazón de las páginas legales (`/privacidad`, `/aviso-legal`, `/cookies`).
 *
 * Son BORRADORES: el texto es genérico, orientado a cómo funciona hoy la
 * aplicación, y lleva entre corchetes los datos que faltan del titular. La
 * franja de arriba lo dice en todas, y no se quita hasta que el texto esté
 * revisado (pendiente de Gabriel, 25-sep-2026).
 *
 * Pantalla pública y en claro (`pantalla-acceso`), como el acceso.
 */
export function PaginaLegal({
  titulo,
  actualizado,
  children,
}: {
  titulo: string;
  actualizado: string;
  children: ReactNode;
}) {
  return (
    <main className="pantalla-acceso mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10">
      <Link href="/" className="inline-flex self-start" aria-label="terap.ia, ir al inicio">
        <Brandmark height={40} />
      </Link>

      <p
        role="note"
        className="rounded-md border border-warning-line bg-warning-soft px-4 py-3 text-[13px] text-warning-ink"
      >
        <strong className="font-semibold">Borrador pendiente de revisión legal.</strong>{" "}
        Los datos entre corchetes están por completar. Mientras la aplicación
        funcione en modo demostración, no introduzcas datos reales de pacientes.
      </p>

      <header>
        <h1 className="page-title">{titulo}</h1>
        <p className="mt-2 text-[13px] text-ink-3">Última actualización: {actualizado}</p>
      </header>

      <div className="flex flex-col gap-7 text-[14.5px] leading-relaxed text-ink-2 [&_h2]:text-headline [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>

      <nav
        aria-label="Información legal"
        className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-[13px]"
      >
        <Link href="/aviso-legal" className="text-accent hover:underline">
          Aviso legal
        </Link>
        <Link href="/privacidad" className="text-accent hover:underline">
          Política de privacidad
        </Link>
        <Link href="/cookies" className="text-accent hover:underline">
          Política de cookies
        </Link>
        <Link href="/" className="ml-auto text-ink-3 hover:text-ink">
          Volver al inicio
        </Link>
      </nav>
    </main>
  );
}

/** Enlaces legales en una línea, para los pies de la portada y del acceso. */
export function EnlacesLegales({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Información legal" className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      <Link href="/aviso-legal">Aviso legal</Link>
      <Link href="/privacidad">Privacidad</Link>
      <Link href="/cookies">Cookies</Link>
    </nav>
  );
}
