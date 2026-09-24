import { SkeletonBlock, SkeletonScreen, SkeletonTitle } from "@/components/Skeletons";

/**
 * El esqueleto dibuja lo que va a aparecer: seis cifras sin caja, dos series
 * lado a lado y tres bloques de detalle. `SkeletonTiles` pinta tarjetas con
 * borde, que es justo el mosaico que la pantalla no tiene, así que no se usa.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Cargando la analítica…">
      <SkeletonTitle />
      <div className="grid grid-cols-2 gap-x-7 gap-y-5 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-7 w-16" />
            <div className="skeleton h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
      </div>
      <div className="grid gap-x-10 gap-y-6 md:grid-cols-3">
        <SkeletonBlock className="h-44" />
        <SkeletonBlock className="h-44" />
        <SkeletonBlock className="h-44" />
      </div>
    </SkeletonScreen>
  );
}
