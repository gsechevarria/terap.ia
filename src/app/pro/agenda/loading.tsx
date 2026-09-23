import { SkeletonScreen, SkeletonTitle } from "@/components/Skeletons";

/*
 * El esqueleto reproduce la rejilla real de la agenda: calendario a la
 * izquierda y columna de «Nueva cita» a la derecha. Un solo bloque a todo lo
 * ancho anunciaba una pantalla que no es la que llega después.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Cargando la agenda…">
      <SkeletonTitle />
      <div className="grid items-start gap-7 xl:grid-cols-[1fr_19rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton h-8 w-44 rounded-xl" />
            <div className="skeleton h-8 w-40 rounded-xl" />
          </div>
          <div className="skeleton h-[32rem] w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="skeleton h-72 w-full rounded-2xl" />
          <div className="skeleton h-9 w-full rounded-lg" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
