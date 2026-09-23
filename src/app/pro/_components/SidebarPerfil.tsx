import { SignOutForm } from "@/components/SignOutForm";
import { sinTratamiento } from "@/lib/frase-del-dia";

/**
 * Iniciales del nombre, para el avatar. Una sola letra si no hay apellido.
 *
 * Se calculan sobre el nombre SIN el tratamiento: con «Dra. Ana Romero», tomar
 * la primera y la última palabra daba «DR», que son la inicial del título y la
 * del apellido. Lo que identifica a una persona es «AR».
 */
function iniciales(nombre: string | null, correo: string): string {
  const partes = sinTratamiento(nombre).split(/\s+/).filter(Boolean);
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
  /*
   * En una consulta individual, la organización se llama como su profesional,
   * así que la segunda línea repetía la primera palabra por palabra. Cuando
   * coinciden se cae al correo, que es el dato que de verdad falta ahí: con qué
   * cuenta se ha entrado. Se comparan sin el tratamiento y sin mayúsculas,
   * porque «Dra. Ana Romero» y «Ana Romero» son la misma consulta.
   */
  const normaliza = (s: string) => sinTratamiento(s).toLocaleLowerCase("es");
  const consulta =
    organizacion && nombre && normaliza(organizacion) === normaliza(nombre)
      ? null
      : organizacion;
  const segundaLinea = consulta ?? correo;

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
        <p className="truncate text-[12px] text-ink-4" title={segundaLinea}>
          {segundaLinea}
        </p>
      </div>
      <SignOutForm soloIcono />
    </div>
  );
}
