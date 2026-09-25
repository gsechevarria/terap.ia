import { manrope } from "@/app/_landing/fuentes";

/** Trazado de la «t», el mismo de `public/logo-mark.svg` y de los iconos. */
const T =
  "M28.2 13 L34.6 10.6 L34.6 21.6 L43.4 21.6 L43.4 25.6 L34.6 25.6 L34.6 42.6 Q34.6 47.2 38.6 47.2 Q41.2 47.2 43.6 45.2 L44.8 47 Q41 51.6 35.6 51.6 Q28.2 51.6 28.2 43.6 L28.2 25.6 L22.6 25.6 L22.6 23.4 Q26.8 21.2 28.2 13 Z";

/**
 * Marca de Terap: la de la portada, en toda la aplicación.
 *
 * Cuadrado `#172e3a` con tres esquinas redondeadas y la inferior izquierda casi
 * en pico, «t» lima `#d2ed87` y la palabra «terap.» en Manrope extrabold. Los
 * colores del cuadrado son de marca y no cambian con el tema; la palabra toma
 * el color del texto que la rodea.
 *
 * La «t» es un trazado vectorial y no una letra de Georgia: Android no trae
 * Georgia, y la marca cambiaba de forma según el dispositivo. Manrope se
 * auto-hospeda con `next/font` (la CSP sigue en `font-src 'self'`).
 *
 * `tamano` es el cuerpo de la palabra, en px; el resto sale en proporción, con
 * las medidas de la portada (32 px de cuerpo, cuadrado de 37 y separación de 9).
 */
export function MarcaTerap({
  tamano = 20,
  soloMarca = false,
  className = "",
}: {
  tamano?: number;
  /** Solo el cuadrado con la «t», sin la palabra. */
  soloMarca?: boolean;
  className?: string;
}) {
  const lado = Math.round(tamano * 1.16);
  return (
    <span
      role="img"
      aria-label="Terap"
      className={`inline-flex shrink-0 items-center ${className}`}
      style={{ gap: Math.round(tamano * 0.28) }}
    >
      <svg viewBox="0 0 64 64" width={lado} height={lado} aria-hidden className="shrink-0">
        <path
          fill="#172e3a"
          d="M18 3 H46 Q61 3 61 18 V46 Q61 61 46 61 H6 Q3 61 3 58 V18 Q3 3 18 3 Z"
        />
        <path fill="#d2ed87" d={T} />
      </svg>
      {!soloMarca && (
        <span
          aria-hidden
          className={manrope.className}
          style={{
            fontSize: tamano,
            fontWeight: 800,
            letterSpacing: "-0.053em",
            lineHeight: 1,
          }}
        >
          terap<span style={{ marginLeft: "-0.06em" }}>.</span>
        </span>
      )}
    </span>
  );
}
