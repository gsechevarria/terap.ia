import { Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { CIFRADO, MARCO_NORMATIVO, MODO_DEMOSTRACION } from "@/lib/entorno-clinico";

/**
 * Franja superior fija: marco normativo, nodo de procesamiento y estado del
 * cifrado. Alto fijado en `--banner-h`, que la barra lateral del panel
 * descuenta para calcular su altura pegajosa.
 *
 * Mientras el entorno sea de demostración, el aviso de datos ficticios manda:
 * presentar "entorno clínico protegido" sobre datos inventados, sin DPA ni base
 * jurídica del artículo 9, sería exactamente la afirmación que no toca hacer.
 * Cuando `NEXT_PUBLIC_DEMO_MODE` pase a "false", la franja queda en su versión
 * reglamentaria.
 */
export function FranjaReglamentaria() {
  return (
    <div
      className={`sticky top-0 z-30 flex h-[var(--banner-h)] items-center justify-between gap-4 border-b border-line px-4 text-xs ${
        MODO_DEMOSTRACION ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-2"
      }`}
    >
      <p className="flex min-w-0 items-center gap-1.5 font-medium">
        {MODO_DEMOSTRACION ? (
          <>
            <TriangleAlert size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="truncate">
              Entorno de demostración — datos ficticios
            </span>
          </>
        ) : (
          <>
            <ShieldCheck size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="truncate">
              Entorno clínico protegido · {MARCO_NORMATIVO}
            </span>
          </>
        )}
      </p>

      {/* Cifrado. Se oculta en pantallas estrechas: en un móvil el mensaje
          principal es lo único que cabe sin truncarse. */}
      <p className="hidden shrink-0 items-center gap-1.5 sm:flex">
        <Lock size={12} strokeWidth={1.75} aria-hidden />
        Cifrado {CIFRADO}
      </p>
    </div>
  );
}
