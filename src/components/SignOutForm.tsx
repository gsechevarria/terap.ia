/** Botón de cierre de sesión. Postea al route handler /auth/signout (sin JS). */
export function SignOutForm() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="btn-subtle h-7 px-2 text-xs">
        Cerrar sesión
      </button>
    </form>
  );
}
