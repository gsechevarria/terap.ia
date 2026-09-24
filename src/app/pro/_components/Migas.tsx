import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Ruta de migas de las subpantallas del panel: «Pacientes › Ana Nadal ›
 * PHQ-9». Es la que ya usaba la ficha del paciente, sacada aquí para que las
 * demás subpantallas vuelvan atrás igual en vez de cada una con su «← Volver»
 * de tamaño y flecha distintos.
 *
 * El último tramo es la pantalla en la que se está: va sin enlace y con
 * `aria-current`.
 */
export function Migas({ tramos }: { tramos: { href?: string; texto: string }[] }) {
  return (
    <nav aria-label="Ruta" className="flex min-w-0 items-center gap-2 text-label-sm text-ink-3">
      {tramos.map((t, i) => {
        const ultimo = i === tramos.length - 1;
        return (
          <span key={`${i}-${t.texto}`} className="flex min-w-0 items-center gap-2">
            {i > 0 && (
              <ChevronRight
                size={13}
                strokeWidth={1.75}
                aria-hidden
                className="shrink-0 text-ink-4"
              />
            )}
            {ultimo || !t.href ? (
              <span
                aria-current={ultimo ? "page" : undefined}
                className={`truncate ${ultimo ? "font-medium text-ink" : ""}`}
              >
                {t.texto}
              </span>
            ) : (
              <Link href={t.href} className="shrink-0 transition-colors hover:text-accent">
                {t.texto}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
