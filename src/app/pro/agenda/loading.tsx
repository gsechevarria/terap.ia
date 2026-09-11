import {
  SkeletonScreen,
  SkeletonBlock,
  SkeletonTitle,
} from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonScreen label="Cargando la agenda…">
      <SkeletonTitle />
      <SkeletonBlock className="h-[32rem]" />
    </SkeletonScreen>
  );
}
