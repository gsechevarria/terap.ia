/**
 * Marca de terap.ia: emblema (imagen) + wordmark de texto.
 *
 * El emblema se pinta como `background-image` de `/logo-mark.png` para que, si
 * el archivo aún no está en `public/`, degrade a un hueco vacío (sin icono de
 * imagen rota) en lugar de romper la cabecera. Coloca el logo recortado al
 * círculo en `public/logo-mark.png`.
 */
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
        className="shrink-0 rounded-full bg-contain bg-center bg-no-repeat"
        style={{
          width: size,
          height: size,
          backgroundImage: "url(/logo-mark.png)",
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
