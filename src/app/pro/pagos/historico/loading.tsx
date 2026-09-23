import {
  SkeletonBlock,
  SkeletonRows,
  SkeletonScreen,
  SkeletonTitle,
} from "@/components/Skeletons";

/**
 * El esqueleto dibuja lo que va a aparecer: segmentado de rangos, bloque de
 * filtros, cuatro cifras SIN caja, gráfica y tabla. `SkeletonTiles` pinta
 * cuatro tarjetas con borde, que es justo el mosaico que la pantalla ya no
 * tiene, así que aquí no se usa.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Cargando el histórico de pagos…">
      <SkeletonTitle />
      <div className="skeleton h-9 w-full max-w-[420px]" />
      <div className="skeleton h-[104px] w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-7 w-20" />
          </div>
        ))}
      </div>
      <SkeletonBlock className="h-56" />
      <SkeletonRows count={8} />
    </SkeletonScreen>
  );
}
