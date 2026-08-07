/**
 * Valida una URL externa introducida por una persona (hoy solo `video_link`).
 *
 * El campo se inyecta tal cual como `href` en la agenda y en la vista de citas
 * del paciente. Sin filtrar el esquema, un `javascript:...` guardado ahí se
 * ejecutaría al pinchar, con la sesión de quien pinche. También se descartan
 * `data:` y `vbscript:`, que sirven para lo mismo.
 *
 * Se valida al guardar y otra vez al renderizar: lo primero evita que entre,
 * lo segundo cubre lo que ya estuviera en la base de datos.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null; // sin esquema o mal formada
  }
  return url.protocol === "http:" || url.protocol === "https:"
    ? url.toString()
    : null;
}
