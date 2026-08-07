import {
  SkeletonScreen,
  SkeletonRows,
  SkeletonTiles,
  SkeletonTitle,
} from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonScreen label="Cargando el panel…">
      <SkeletonTitle />
      <SkeletonTiles count={4} />
      <SkeletonRows count={6} />
    </SkeletonScreen>
  );
}
