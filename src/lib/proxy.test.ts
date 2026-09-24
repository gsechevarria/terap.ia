import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => ({ user: null as null | { id: string; app_metadata: { role: string } } }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: auth.user } }) } }) }));
import { config, proxy } from "../proxy";
afterEach(() => { vi.unstubAllEnvs(); auth.user = null; });
function setup(role?: string) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "ficticia");
  if (role) auth.user = { id: "ficticio", app_metadata: { role } };
}
describe("proxy y límites de rutas", () => {
  it("permite al profesional exportar ICS sin confundir /appointments con /app", async () => {
    setup("professional");
    const result = await proxy(new NextRequest("https://example.invalid/appointments/123/ics"));
    expect(result.headers.get("location")).toBeNull();
  });
  it("bloquea el área del otro rol", async () => {
    setup("patient");
    const result = await proxy(new NextRequest("https://example.invalid/pro/pagos"));
    expect(result.headers.get("location")).toBe("https://example.invalid/app");
  });
  it("sin sesión, la administración lleva a su propio acceso y el resto al general", async () => {
    setup();
    const admin = await proxy(new NextRequest("https://example.invalid/admin"));
    expect(admin.headers.get("location")).toBe("https://example.invalid/admin/login");
    const pro = await proxy(new NextRequest("https://example.invalid/pro/pagos"));
    expect(pro.headers.get("location")).toBe("https://example.invalid/login");
    // El acceso de administración es público: sin esto, el redirect sería un bucle.
    const puerta = await proxy(new NextRequest("https://example.invalid/admin/login"));
    expect(puerta.headers.get("location")).toBeNull();
    // `/administracion` no es `/admin/…`: no hereda su puerta.
    const otra = await proxy(new NextRequest("https://example.invalid/administracion"));
    expect(otra.headers.get("location")).toBe("https://example.invalid/login");
  });
  it("el matcher deja fuera los artefactos que el service worker precachea", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    // `cache.addAll` rechaza un redirect: si el proxy protegiera estas rutas,
    // una sesión caducada rompería la instalación entera del service worker.
    for (const ruta of ["/offline.html", "/sw.js", "/manifest.webmanifest", "/icon-192.png"]) {
      expect(matcher.test(ruta), ruta).toBe(false);
    }
    for (const ruta of ["/pro", "/app/appointments/new", "/login"]) {
      expect(matcher.test(ruta), ruta).toBe(true);
    }
  });
  it("la CSP de petición y respuesta comparte nonce, distinto por visita", async () => {
    setup();
    const first = new NextRequest("https://example.invalid/login"), second = new NextRequest("https://example.invalid/login");
    const response = await proxy(first); await proxy(second);
    expect(first.headers.get("x-nonce")).not.toBe(second.headers.get("x-nonce"));
    expect(response.headers.get("Content-Security-Policy")).toContain(`'nonce-${first.headers.get("x-nonce")}'`);
    expect(response.headers.get("Content-Security-Policy")).toBe(first.headers.get("Content-Security-Policy"));
  });
});
