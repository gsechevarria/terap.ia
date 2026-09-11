import {
  SkeletonScreen,
  SkeletonBlock,
  SkeletonRows,
  SkeletonTiles,
  SkeletonTitle,
} from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonScreen label="Cargando el histórico de pagos…">
      <SkeletonTitle />
      <SkeletonTiles count={4} />
      <SkeletonBlock className="h-56" />
      <SkeletonRows count={8} />
    </SkeletonScreen>
  );
}
