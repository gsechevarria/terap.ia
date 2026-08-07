/**
 * Piezas de esqueleto para los `loading.tsx`.
 *
 * Usan las clases `.skeleton` de `globals.css`, que existían desde el rediseño
 * pero no se aplicaban en ninguna vista. Son puramente decorativas, así que van
 * dentro de un contenedor con `aria-hidden` y un texto para lector de pantalla.
 */

export function SkeletonScreen({
  label = "Cargando…",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-5">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-4 ${className}`} />;
}

export function SkeletonTitle() {
  return <div className="skeleton h-7 w-52" />;
}

/** Fila de tiles de resumen. */
export function SkeletonTiles({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card flex flex-col gap-2 p-4">
          <SkeletonLine className="w-24" />
          <div className="skeleton h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Lista o tabla de filas. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="card divide-y divide-line">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <SkeletonLine className="w-1/3" />
            <SkeletonLine className="h-3 w-1/2" />
          </div>
          <SkeletonLine className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Bloque grande (gráfica, calendario). */
export function SkeletonBlock({ className = "h-72" }: { className?: string }) {
  return <div className={`skeleton ${className} w-full rounded-lg`} />;
}
