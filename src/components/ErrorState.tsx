"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";

/**
 * Pantalla compartida por los error boundaries (`error.tsx`).
 *
 * No se muestra ni el mensaje ni la traza del error: pueden contener datos del
 * paciente o detalles del esquema. El `digest` sí se ofrece, plegado, porque es
 * lo único que permite localizar el fallo en los logs del servidor.
 */
export function ErrorState({
  error,
  reset,
  homeHref = "/",
  homeLabel = "Ir al inicio",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
      <span className="flex size-9 items-center justify-center rounded-lg bg-danger-soft text-danger">
        <TriangleAlert className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <div>
        <h1 className="text-lg font-semibold">Algo ha fallado</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
          No hemos podido cargar esta página. No se ha perdido nada de lo que ya
          estaba guardado. Puedes reintentarlo; si vuelve a ocurrir, avísanos.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="btn-primary gap-1.5">
          <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden />
          Reintentar
        </button>
        <Link href={homeHref} className="btn-ghost">
          {homeLabel}
        </Link>
      </div>
      {error.digest && (
        <details className="mt-2 text-xs text-ink-3">
          <summary className="cursor-pointer hover:text-ink">
            Referencia para soporte
          </summary>
          <code className="mt-1 block font-mono break-all">{error.digest}</code>
        </details>
      )}
    </div>
  );
}
