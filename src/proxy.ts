import { contentSecurityPolicy } from "@/lib/csp";
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

/**
 * Rutas públicas. `/registro` lo es porque el alta profesional empieza sin
 * sesión; `/invitacion` y `/unirse` porque el enlace se abre antes de tener
 * cuenta, y ABRIRLO NO CONSUME NADA: el token se canjea al aceptar.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/invite",
  "/invitacion",
  "/unirse",
  "/registro",
  "/acceso",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function withCookies(from: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  const csp = from.headers.get("Content-Security-Policy");
  if (csp) redirect.headers.set("Content-Security-Policy", csp);
  return redirect;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);
  const next = () => {
    const result = NextResponse.next({ request: { headers: request.headers } });
    result.headers.set("Content-Security-Policy", csp);
    return result;
  };
  let response = next();

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
        response = next();
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

  /*
   * Alta profesional pendiente de revisión.
   *
   * Puede consultar su estado y terminar el onboarding, y nada más. NO entra
   * en el panel: el rol operativo solo lo concede un administrador al aprobar,
   * y hasta entonces la RLS tampoco le daría un solo expediente.
   *
   * Se le deja pasar por `/account` (contraseña) y por `/unirse` (puede haber
   * sido invitado a un centro mientras esperaba).
   */
  if (role === ROLES.PROFESSIONAL_PENDING) {
    const permitidas = ["/registro", "/account", "/unirse", "/auth", "/contexto"];
    if (!permitidas.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return withCookies(response, new URL("/registro/estado", request.url));
    }
    return response;
  }

  // Con sesión pero sin rol válido: bloquear áreas protegidas.
  if (!role) {
    if ((pathname === "/pro" || pathname.startsWith("/pro/")) || (pathname === "/app" || pathname.startsWith("/app/"))) {
      return withCookies(response, new URL("/login?error=sin-rol", request.url));
    }
    return response;
  }

  /*
   * Aislamiento por área.
   *
   * Ya NO se rebota a un profesional que entra en `/app`: desde que una cuenta
   * puede ser profesional en un centro y paciente en otro, esa redirección le
   * dejaba fuera de su propio expediente. Quien decide es el layout de `/app`,
   * que comprueba si de verdad hay un expediente vinculado y, si no lo hay,
   * manda al panel. El rebote de paciente a `/pro` sí se conserva: un paciente
   * no tiene nada que hacer ahí y el panel se lo negaría igualmente.
   */
  if (role === ROLES.PATIENT && (pathname === "/pro" || pathname.startsWith("/pro/"))) {
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
     * - offline.html: fallback de navegación del service worker. Es estática,
     *   no lleva datos y trae el 024. Protegerla hacía fallar el `addAll` de la
     *   instalación del service worker si la sesión caducaba justo entonces.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
