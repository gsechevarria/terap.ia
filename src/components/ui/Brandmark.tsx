/**
 * Logotipo de terap.ia: muestra el logo completo subido (`/logo.png`, PNG con
 * fondo transparente: emblema + palabra), recortando el margen transparente
 * para que el lockup ocupe la caja. Controlado por `height` (px); el ancho
 * sigue la proporción del contenido. Si cambias la imagen y el encuadre no
 * cuadra, ajusta CONTENT_RATIO / MARK_ZOOM / MARK_POS.
 */
const CONTENT_RATIO = 1.24; // ancho/alto del contenido del logo (emblema+texto)
const MARK_ZOOM = "225%"; // ampliación para recortar el margen de la imagen
const MARK_POS = "49% 47%"; // centro del contenido dentro de la imagen

export function Brandmark({
  height = 40,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="terap.ia"
      className={`inline-block shrink-0 bg-no-repeat ${className}`}
      style={{
        height,
        width: Math.round(height * CONTENT_RATIO),
        backgroundImage: "url(/logo.png)",
        backgroundSize: MARK_ZOOM,
        backgroundPosition: MARK_POS,
      }}
    />
  );
}
