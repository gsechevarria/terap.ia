/**
 * Marca de terap.ia: emblema (imagen) + wordmark de texto.
 *
 * `/logo-mark.png` es el logotipo completo (emblema + palabra, con margen). Se
 * pinta como `background-image` ampliado y reencuadrado para mostrar SOLO el
 * emblema circular dentro del recorte redondo. Si cambias la imagen y el
 * encuadre no cuadra, ajusta MARK_ZOOM / MARK_POS.
 */
const MARK_ZOOM = "434%";
const MARK_POS = "49.5% 39%";

export function Brandmark({
  size = 24,
  showText = true,
  textClassName = "text-[15px]",
  className = "",
}: {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="shrink-0 rounded-full bg-no-repeat"
        style={{
          width: size,
          height: size,
          backgroundImage: "url(/logo-mark.png)",
          backgroundSize: MARK_ZOOM,
          backgroundPosition: MARK_POS,
        }}
      />
      {showText ? (
        <span
          className={`font-semibold tracking-[-0.01em] text-ink ${textClassName}`}
        >
          terap.ia
        </span>
      ) : (
        <span className="sr-only">terap.ia</span>
      )}
    </span>
  );
}
