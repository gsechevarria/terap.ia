import { MarcaTerap } from "@/components/ui/MarcaTerap";

/**
 * Logotipo de las pantallas de entrada, de la app del paciente y de las
 * páginas legales. Antes era la imagen `/logo.png` (emblema y palabra de
 * «terap.ia»); ahora es la marca de Terap (`MarcaTerap`).
 *
 * Conserva la firma de antes —`height`, el alto aproximado del logotipo en
 * px— para no tocar a quien la usa. El logotipo nuevo es apaisado, así que el
 * cuerpo de la palabra se acota: a 120 px de alto no cabría en la tarjeta del
 * acceso.
 */
export function Brandmark({
  height = 40,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  const tamano = Math.min(44, Math.max(16, Math.round(height * 0.45)));
  return <MarcaTerap tamano={tamano} className={className} />;
}
