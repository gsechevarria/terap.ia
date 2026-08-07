import {
  SkeletonScreen,
  SkeletonLine,
  SkeletonRows,
  SkeletonTitle,
} from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonScreen label="Cargando la ficha del paciente…">
      <SkeletonTitle />
      <SkeletonLine className="w-40" />
      <SkeletonRows count={5} />
    </SkeletonScreen>
  );
}
