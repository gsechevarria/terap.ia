import {
  SkeletonScreen,
  SkeletonBlock,
  SkeletonRows,
  SkeletonTiles,
  SkeletonTitle,
} from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonScreen label="Cargando contabilidad…">
      <SkeletonTitle />
      <SkeletonBlock className="h-40" />
      <SkeletonTiles count={3} />
      <SkeletonRows count={5} />
    </SkeletonScreen>
  );
}
