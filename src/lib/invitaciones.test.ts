import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * Estado del acceso del paciente y construcción de los enlaces.
 *
 * Son las dos piezas del sistema de invitaciones que no viven en SQL y que, si
 * se equivocan, no fallan ruidosamente: un estado mal derivado enseña
 * "pendiente" sobre un enlace muerto, y una URL mal construida entrega el token
 * al dominio equivocado.
 */

// Copia literal de la derivación de `queries/invitations.ts`. Se duplica a
// propósito: esa función toca Supabase y aquí interesa la regla, no el cliente.
type Inv = {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
};
function derivar(inv: Inv | null, tieneCuenta: boolean) {
  if (tieneCuenta) return "vinculado";
  if (!inv) return "sin_invitar";
  if (inv.accepted_at) return "vinculado";
  if (inv.revoked_at) return "revocada";
  return new Date(inv.expires_at).getTime() <= Date.now() ? "caducada" : "pendiente";
}

const futuro = new Date(Date.now() + 3600_000).toISOString();
const pasado = new Date(Date.now() - 3600_000).toISOString();

describe("estado del acceso del paciente", () => {
  it("sin invitación y sin cuenta: sin invitar", () => {
    expect(derivar(null, false)).toBe("sin_invitar");
  });

  it("invitación viva: pendiente", () => {
    expect(derivar({ accepted_at: null, revoked_at: null, expires_at: futuro }, false)).toBe("pendiente");
  });

  it("invitación pasada de fecha: caducada", () => {
    expect(derivar({ accepted_at: null, revoked_at: null, expires_at: pasado }, false)).toBe("caducada");
  });

  it("invitación revocada: revocada, aunque no hubiera caducado", () => {
    expect(derivar({ accepted_at: null, revoked_at: pasado, expires_at: futuro }, false)).toBe("revocada");
  });

  it("aceptada: vinculado", () => {
    expect(derivar({ accepted_at: pasado, revoked_at: null, expires_at: pasado }, false)).toBe("vinculado");
  });

  it("la cuenta ya vinculada manda sobre cualquier invitación vieja", () => {
    // Puede haber una invitación caducada de antes de que aceptara otra.
    expect(derivar({ accepted_at: null, revoked_at: null, expires_at: pasado }, true)).toBe("vinculado");
  });
});

describe("construcción de los enlaces de invitación", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  async function cargar() {
    // `server-only` lanza fuera de un componente de servidor; en la prueba se
    // neutraliza porque lo que se está comprobando es aritmética de cadenas.
    vi.doMock("server-only", () => ({}));
    return import("@/lib/urls");
  }

  it("usa el dominio configurado y no las cabeceras", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://terap.vercel.app/";
    const { urlDeInvitacionPaciente, urlDeInvitacionProfesional } = await cargar();
    expect(urlDeInvitacionPaciente("abc")).toBe("https://terap.vercel.app/invitacion/abc");
    expect(urlDeInvitacionProfesional("abc")).toBe("https://terap.vercel.app/unirse/abc");
  });

  it("escapa el token en la ruta", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://terap.vercel.app";
    const { urlDeInvitacionPaciente } = await cargar();
    expect(urlDeInvitacionPaciente("a/b?c=1")).toBe(
      "https://terap.vercel.app/invitacion/a%2Fb%3Fc%3D1",
    );
  });

  it("rechaza HTTP fuera de local: el token viajaría en claro", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://terap.example.com";
    const { urlDeInvitacionPaciente } = await cargar();
    expect(() => urlDeInvitacionPaciente("abc")).toThrow(/HTTPS/);
  });

  it("admite http en localhost, que es donde hace falta", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    const { urlDeInvitacionPaciente } = await cargar();
    expect(urlDeInvitacionPaciente("abc")).toBe("http://localhost:3000/invitacion/abc");
  });

  it("falla si no hay dominio configurado, en vez de inventarse uno", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { urlDeInvitacionPaciente } = await cargar();
    expect(() => urlDeInvitacionPaciente("abc")).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
