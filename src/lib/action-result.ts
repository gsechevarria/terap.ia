export class ActionInputError extends Error {}
export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };
/** El cliente solo continúa (limpia/cierra el formulario) si el servidor confirmó éxito. */
export async function callAction<Args extends unknown[], T>(action: (...args: Args) => Promise<ActionResult<T>>, ...args: Args): Promise<T> {
  const result = await action(...args);
  if (!result.success) throw new ActionInputError(result.error);
  return result.data;
}
