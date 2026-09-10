/** Errores de lectura nunca se convierten en ceros o listas vacías. */
export async function checked<T extends { error: { message: string } | null }>(request: PromiseLike<T>): Promise<T> {
  const result = await request;
  if (result.error) throw new Error("No se pudieron obtener los datos. Inténtalo de nuevo.");
  return result;
}
type Page<T> = { data: T[] | null; error: { message: string } | null };
/** Avanza por lo recibido, incluso cuando el servidor impone un límite inferior. */
export async function allRows<T>(query: {
  order(column: string): { range(from: number, to: number): PromiseLike<Page<T>> };
}): Promise<{ data: T[]; error: null }> {
  const ordered = query.order("id");
  const rows: T[] = [];
  for (;;) {
    const result = await checked(ordered.range(rows.length, rows.length + 499));
    const page = result.data ?? [];
    if (page.length === 0) return { data: rows, error: null };
    rows.push(...page);
  }
}
