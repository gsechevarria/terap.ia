import { LogOut } from "lucide-react";

/** Botón de cierre de sesión. Postea al route handler /auth/signout (sin JS). */
export function SignOutForm() {
  return (
    <form action="/auth/signout" method="post">
      {/* Por debajo de 640 px el texto se oculta y el icono es `aria-hidden`:
          sin `aria-label` el botón se quedaba sin nombre accesible, justo al
          lado del botón rojo de emergencia. */}
      <button
        type="submit"
        aria-label="Cerrar sesión"
        className="btn-subtle h-7 gap-1 px-2 text-xs"
      >
        <LogOut className="size-3.5" strokeWidth={2} aria-hidden />
        <span className="hidden sm:inline">Cerrar sesión</span>
      </button>
    </form>
  );
}
