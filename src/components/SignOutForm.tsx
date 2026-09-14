import { LogOut } from "lucide-react";

/**
 * Botón de cierre de sesión. Postea al route handler /auth/signout (sin JS).
 *
 * `soloIcono` lo reduce al icono para la tarjeta de perfil de la barra
 * lateral, donde el texto no cabe. Aun así conserva `aria-label`: el icono va
 * `aria-hidden` y sin la etiqueta el botón se quedaría sin nombre accesible.
 */
export function SignOutForm({ soloIcono = false }: { soloIcono?: boolean }) {
  return (
    <form action="/auth/signout" method="post" className="shrink-0">
      <button
        type="submit"
        aria-label="Cerrar sesión"
        title={soloIcono ? "Cerrar sesión" : undefined}
        className={
          soloIcono
            ? "rounded p-1 text-ink-3 transition-colors hover:bg-wash hover:text-ink"
            : "btn-subtle h-7 gap-1.5 px-2 text-[12px]"
        }
      >
        <LogOut size={16} strokeWidth={1.75} aria-hidden />
        {!soloIcono && <span className="hidden sm:inline">Cerrar sesión</span>}
      </button>
    </form>
  );
}
