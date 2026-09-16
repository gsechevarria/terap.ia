import { describe, expect, it } from "vitest";
import { ROLES, getUserRole, homePathForRole, puedeEntrarAlPanel } from "@/lib/auth/roles";
import type { User } from "@supabase/supabase-js";

/**
 * Lógica pura del registro y los roles.
 *
 * Lo que se comprueba aquí es lo que NO puede comprobarse en SQL: cómo
 * interpreta la aplicación lo que le llega de la sesión. Las garantías de
 * verdad —quién ve qué— viven en la RLS y se prueban en `test:types`.
 */

const usuario = (app: Record<string, unknown>, meta: Record<string, unknown> = {}) =>
  ({ app_metadata: app, user_metadata: meta }) as unknown as User;

describe("resolución de rol", () => {
  it("lee el rol de app_metadata", () => {
    expect(getUserRole(usuario({ role: "professional" }))).toBe(ROLES.PROFESSIONAL);
    expect(getUserRole(usuario({ role: "patient" }))).toBe(ROLES.PATIENT);
    expect(getUserRole(usuario({ role: "professional_pending" }))).toBe(
      ROLES.PROFESSIONAL_PENDING,
    );
  });

  it("IGNORA user_metadata, que el propio usuario puede reescribir", () => {
    // Este es el fallo de agosto: `updateUser({ data: { role } })` es una
    // llamada que cualquier paciente puede hacer con la clave pública.
    const impostor = usuario({ role: "patient" }, { role: "professional" });
    expect(getUserRole(impostor)).toBe(ROLES.PATIENT);
  });

  it("no acepta roles inventados", () => {
    expect(getUserRole(usuario({ role: "admin" }))).toBeNull();
    expect(getUserRole(usuario({ role: "superuser" }))).toBeNull();
    expect(getUserRole(usuario({}))).toBeNull();
    expect(getUserRole(null)).toBeNull();
  });
});

describe("a dónde lleva cada rol", () => {
  it("el pendiente va a su estado, nunca al panel", () => {
    expect(homePathForRole(ROLES.PROFESSIONAL_PENDING)).toBe("/registro/estado");
    expect(puedeEntrarAlPanel(ROLES.PROFESSIONAL_PENDING)).toBe(false);
  });

  it("solo el profesional aprobado entra al panel", () => {
    expect(homePathForRole(ROLES.PROFESSIONAL)).toBe("/pro");
    expect(puedeEntrarAlPanel(ROLES.PROFESSIONAL)).toBe(true);
    expect(puedeEntrarAlPanel(ROLES.PATIENT)).toBe(false);
    expect(puedeEntrarAlPanel(null)).toBe(false);
  });

  it("el paciente va a su área", () => {
    expect(homePathForRole(ROLES.PATIENT)).toBe("/app");
  });
});
