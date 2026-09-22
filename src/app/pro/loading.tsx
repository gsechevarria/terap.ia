import { SkeletonBlock, SkeletonLine, SkeletonScreen } from "@/components/Skeletons";

/** Esqueleto de «Hoy»: saludo, tarjeta de próxima sesión, agenda y analítica. */
export default function Loading() {
  return (
    <SkeletonScreen label="Cargando tu jornada…">
      <div className="flex flex-col gap-7 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-6">
          <div className="flex flex-col gap-3">
            <div className="skeleton h-10 w-72" />
            <SkeletonLine className="w-full max-w-[500px]" />
            <SkeletonLine className="w-2/3 max-w-[500px]" />
          </div>
          <SkeletonBlock className="h-10 max-w-[520px]" />
        </div>
        <SkeletonBlock className="h-[240px] lg:w-[500px] lg:shrink-0" />
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <SkeletonBlock className="h-[504px] lg:w-[600px] lg:shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <SkeletonBlock className="h-[140px]" />
          <SkeletonBlock className="h-[200px]" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
