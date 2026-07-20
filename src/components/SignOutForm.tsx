import { LogOut } from "lucide-react";

/** Botón de cierre de sesión. Postea al route handler /auth/signout (sin JS). */
export function SignOutForm() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="btn-subtle h-7 gap-1 px-2 text-xs">
        <LogOut className="size-3.5" strokeWidth={2} aria-hidden />
        <span className="hidden sm:inline">Cerrar sesión</span>
      </button>
    </form>
  );
}
