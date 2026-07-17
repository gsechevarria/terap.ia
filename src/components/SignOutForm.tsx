/** Botón de cierre de sesión. Postea al route handler /auth/signout (sin JS). */
export function SignOutForm() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.16] dark:hover:bg-white/[.06]"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
