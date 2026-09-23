import { SkeletonLine, SkeletonScreen } from "@/components/Skeletons";

/**
 * Esqueleto del listado: título, buscador, pestañas y la tabla.
 *
 * No usa `SkeletonTiles`: esta pantalla no tiene tiles de resumen, y dibujar
 * cuatro tarjetas que luego no aparecen desplaza todo lo de debajo al llegar
 * los datos.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Cargando tus pacientes…">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="skeleton h-10 w-56" />
          <SkeletonLine className="h-3 w-40" />
        </div>

        <div className="skeleton h-[42px] max-w-sm" />
        <SkeletonLine className="h-3 w-64" />

        <div className="table-wrap">
          <div className="h-11 border-b border-line bg-surface-subtle" />
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-line-soft px-4 py-3.5 last:border-b-0"
            >
              <div className="skeleton size-9 shrink-0 rounded-xl" />
              <SkeletonLine className="w-40" />
              <div className="ml-auto flex shrink-0 items-center gap-8">
                <SkeletonLine className="h-3 w-8" />
                <SkeletonLine className="h-3 w-24" />
                <SkeletonLine className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}
