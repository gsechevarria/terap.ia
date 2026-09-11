import {
  SkeletonScreen,
  SkeletonBlock,
  SkeletonTiles,
  SkeletonTitle,
} from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonScreen label="Cargando la analítica…">
      <SkeletonTitle />
      <SkeletonTiles count={4} />
      <SkeletonBlock />
      <SkeletonBlock />
    </SkeletonScreen>
  );
}
