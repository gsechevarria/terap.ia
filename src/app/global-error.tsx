"use client";

import "./globals.css";

/**
 * Último recinto: solo salta si falla el propio layout raíz, así que tiene que
 * traer sus propias etiquetas `<html>`/`<body>` y no puede apoyarse en nada del
 * layout (ni en el banner de demo ni en los componentes compartidos).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <main className="mx-auto flex max-w-md flex-col items-start gap-4 px-6 py-16">
          <h1 className="text-lg font-semibold">Algo ha fallado</h1>
          <p className="text-sm leading-relaxed text-ink-2">
            La aplicación no ha podido cargarse. No se ha perdido nada de lo que
            ya estaba guardado. Vuelve a intentarlo en unos segundos.
          </p>
          <button type="button" onClick={reset} className="btn-primary">
            Reintentar
          </button>
          {error.digest && (
            <details className="mt-2 text-xs text-ink-3">
              <summary className="cursor-pointer hover:text-ink">
                Referencia para soporte
              </summary>
              <code className="mt-1 block font-mono break-all">
                {error.digest}
              </code>
            </details>
          )}
        </main>
      </body>
    </html>
  );
}
