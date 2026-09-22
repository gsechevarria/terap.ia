import { SignOutForm } from "@/components/SignOutForm";

/** Iniciales del nombre, para el avatar. Una sola letra si no hay apellido. */
function iniciales(nombre: string | null, correo: string): string {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return correo.charAt(0).toUpperCase();
  const primera = partes[0]?.charAt(0) ?? "";
  const segunda = partes.length > 1 ? (partes.at(-1)?.charAt(0) ?? "") : "";
  return (primera + segunda).toUpperCase();
}

/**
 * Identidad al pie de la barra lateral: avatar de iniciales, nombre y, debajo,
 * la consulta o centro en el que se está trabajando.
 *
 * La segunda línea es el nombre de la organización, no el correo. Quien puede
 * ser profesional en un centro y paciente en otro necesita ver DÓNDE está
 * trabajando más que su propia dirección de correo, que ya conoce. El correo se
 * conserva en el `title` del avatar, para poder comprobar con qué cuenta se ha
 * entrado sin ocupar una línea con ello.
 *
 * Sin caja ni borde: va directamente sobre el lienzo, como el resto de la barra.
 */
export function SidebarPerfil({
  nombre,
  correo,
  organizacion,
}: {
  nombre: string | null;
  correo: string;
  organizacion?: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5 px-2.5">
      <span
        aria-hidden
        title={correo}
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-green-2 text-[13px] font-semibold text-ink"
      >
        {iniciales(nombre, correo)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13.5px] font-semibold text-ink">
          {nombre ?? "Profesional"}
        </p>
        <p className="truncate text-[12px] text-ink-4" title={organizacion ?? correo}>
          {organizacion ?? correo}
        </p>
      </div>
      <SignOutForm soloIcono />
    </div>
  );
}
