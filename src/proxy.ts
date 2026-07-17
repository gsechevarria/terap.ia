import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLES, getUserRole, homePathForRole } from "@/lib/auth/roles";

/**
 * Proxy (antes "middleware"; renombrado en Next.js 16).
 *
 * Hace dos cosas:
 *  1. Refresca la sesión de Supabase en cada request (imprescindible con SSR).
 *  2. Redirección "optimista" por rol.
 *
 * IMPORTANTE (recomendación de Next.js y Supabase): el proxy NO es la capa de
 * autorización definitiva. Cada layout server de /pro y /app vuelve a verificar
 * usuario + rol con `supabase.auth.getUser()`. Esto es defensa en profundidad.
 */

const PUBLIC_PREFIXES = ["/login", "/auth", "/invite"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function withCookies(from: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase aún sin configurar (placeholders de Sesión 0): no bloquear la app.
  if (!url || !anon || url.includes("TU-PROYECTO")) {
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // NO poner lógica entre createServerClient y getUser: refresca los tokens.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getUserRole(user);

  // Sin sesión → solo rutas públicas.
  if (!user) {
    if (isPublicPath(pathname)) return response;
    return withCookies(response, new URL("/login", request.url));
  }

  // Con sesión en / o /login → llevar a su home por rol.
  if (pathname === "/" || pathname === "/login") {
    if (role) return withCookies(response, new URL(homePathForRole(role), request.url));
    return response; // sin rol válido: dejar en la landing/login
  }

  // Con sesión pero sin rol válido: bloquear áreas protegidas.
  if (!role) {
    if (pathname.startsWith("/pro") || pathname.startsWith("/app")) {
      return withCookies(response, new URL("/login?error=sin-rol", request.url));
    }
    return response;
  }

  // Aislamiento por rol: cada uno solo entra en su área.
  if (role === ROLES.PROFESSIONAL && pathname.startsWith("/app")) {
    return withCookies(response, new URL("/pro", request.url));
  }
  if (role === ROLES.PATIENT && pathname.startsWith("/pro")) {
    return withCookies(response, new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto:
     * - api (route handlers propios)
     * - _next/static, _next/image (assets de Next)
     * - favicon.ico y archivos de imagen estáticos
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
