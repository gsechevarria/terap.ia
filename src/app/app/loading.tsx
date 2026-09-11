import {
  SkeletonScreen,
  SkeletonTitle,
  SkeletonBlock,
  SkeletonRows,
} from "@/components/Skeletons";

/**
 * Cubre toda la app del paciente. Sin esto, tocar una pestaña en el móvil deja
 * la pantalla anterior congelada hasta que responde el servidor: con datos
 * móviles se percibe como que la aplicación se ha quedado colgada.
 */
export default function Loading() {
  return (
    <SkeletonScreen label="Cargando…">
      <SkeletonTitle />
      <SkeletonBlock className="h-28" />
      <SkeletonRows count={3} />
    </SkeletonScreen>
  );
}
