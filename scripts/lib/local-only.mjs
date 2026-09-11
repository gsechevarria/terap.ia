export function assertLocalDatabase(value = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Configura Supabase local en .env.test.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Seed e integración solo admiten Supabase en loopback HTTP. No se ha enviado ninguna petición.');
  }
  return url.origin;
}
