import { Lock, ShieldCheck } from "lucide-react";
import { CIFRADO, MARCO_NORMATIVO, MODO_DEMOSTRACION } from "@/lib/entorno-clinico";

/**
 * Franja superior fija: aviso de entorno de demostración o, cuando se apague,
 * marco normativo y estado del cifrado. Alto fijado en `--banner-h`, que la
 * barra lateral del panel descuenta para calcular su altura pegajosa.
 *
 * Mientras el entorno sea de demostración, el aviso de datos ficticios manda:
 * presentar "entorno clínico protegido" sobre datos inventados, sin DPA ni base
 * jurídica del artículo 9, sería exactamente la afirmación que no toca hacer.
 * Cuando `NEXT_PUBLIC_DEMO_MODE` pase a "false", la franja queda en su versión
 * reglamentaria. Esa lógica no cambia con el rediseño: lo único que cambia es
 * cómo se pinta.
 *
 * Sin icono en el caso de demostración: la franja es una banda oscura que
 * cruza la pantalla entera y ya es, ella misma, la señal. Un triángulo de
 * aviso al lado sería decir dos veces lo mismo.
 */
export function FranjaReglamentaria() {
  if (MODO_DEMOSTRACION) {
    return (
      <div className="sticky top-0 z-30 flex h-[var(--banner-h)] items-center justify-center px-4 text-[12.5px] bg-banner-bg text-banner-ink">
        <p className="truncate">
          Entorno de demostración. Todos los pacientes y datos son ficticios.
        </p>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-30 flex h-[var(--banner-h)] items-center justify-between gap-4 px-4 text-[12.5px] bg-banner-bg text-banner-ink">
      <p className="flex min-w-0 items-center gap-1.5">
        <ShieldCheck size={13} strokeWidth={1.7} aria-hidden className="shrink-0" />
        <span className="truncate">Entorno clínico protegido, {MARCO_NORMATIVO}</span>
      </p>

      {/* Cifrado. Se oculta en pantallas estrechas: en un móvil el mensaje
          principal es lo único que cabe sin truncarse. */}
      <p className="hidden shrink-0 items-center gap-1.5 sm:flex">
        <Lock size={12} strokeWidth={1.7} aria-hidden />
        Cifrado {CIFRADO}
      </p>
    </div>
  );
}
