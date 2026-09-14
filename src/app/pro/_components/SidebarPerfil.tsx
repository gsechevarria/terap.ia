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
 * Tarjeta de identidad al pie de la barra lateral.
 *
 * Muestra solo lo que consta: nombre y correo. El mockup añadía número de
 * colegiado y un estado "En consulta" — `professionals` no tiene columna de
 * colegiación y no hay noción de presencia en la aplicación, así que inventar
 * ambos sería escribir en la interfaz un dato profesional que nadie ha
 * introducido. Cuando existan esas columnas, este es el sitio.
 */
export function SidebarPerfil({
  nombre,
  correo,
}: {
  nombre: string | null;
  correo: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-2">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-label-sm font-semibold text-accent"
      >
        {iniciales(nombre, correo)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-label-sm leading-tight font-semibold text-ink">
          {nombre ?? "Profesional"}
        </p>
        <p className="truncate text-[10px] text-ink-3" title={correo}>
          {correo}
        </p>
      </div>
      <SignOutForm soloIcono />
    </div>
  );
}
