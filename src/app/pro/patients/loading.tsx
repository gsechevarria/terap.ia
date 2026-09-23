import { SkeletonLine, SkeletonScreen } from "@/components/Skeletons";

/**
 * Esqueleto del listado: título con su frase, cabecera de sección con buscador
 * y segmentado, y las filas sin caja, como las pinta la página.
 *
 * No usa `SkeletonTiles`: esta pantalla no tiene tiles de resumen, y dibujar
 * cuatro tarjetas que luego no aparecen desplaza todo lo de debajo al llegar
 * los datos.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Cargando tus pacientes…">
      <div className="flex w-full flex-col gap-[22px]">
        <div className="flex flex-col gap-3">
          <div className="skeleton h-10 w-56" />
          <SkeletonLine className="h-4 w-96 max-w-full" />
        </div>

        <div>
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <SkeletonLine className="h-4 w-40" />
            <div className="flex gap-3">
              <div className="skeleton h-[42px] w-[300px] max-w-full" />
              <div className="skeleton h-[34px] w-56" />
            </div>
          </div>
          <div className="h-9 border-b border-line" />
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-line-soft py-3.5"
            >
              <div className="skeleton size-8 shrink-0 rounded-xl" />
              <SkeletonLine className="w-40" />
              <div className="ml-auto flex shrink-0 items-center gap-8">
                <SkeletonLine className="h-3 w-16" />
                <SkeletonLine className="h-3 w-24" />
                <SkeletonLine className="h-3 w-20" />
                <SkeletonLine className="h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}
