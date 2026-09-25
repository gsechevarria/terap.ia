import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Las pantallas de ENTRADA van siempre en claro.
 *
 * Son la continuación visual de la portada, que es solo clara por diseño, y del
 * área del paciente, que también fuerza claro. Sin esto, quien tiene el móvil
 * en modo oscuro pasaba de `/` a `/acceso` y la pantalla cambiaba de golpe a
 * mitad del mismo gesto.
 *
 * Es un fallo que no rompe nada y por eso vuelve solo: basta con crear una
 * pantalla de entrada nueva y olvidar la clase. Esta prueba fija el contrato en
 * las que ya existen; una nueva hay que añadirla aquí a mano, que es
 * exactamente el momento en que conviene acordarse.
 */

const raiz = fileURLToPath(new URL("../..", import.meta.url));
const leer = (ruta: string) => readFileSync(raiz + ruta, "utf8");

const PANTALLAS = [
  "src/app/acceso/page.tsx",
  "src/app/acceso/paciente/page.tsx",
  "src/app/login/page.tsx",
  "src/app/registro/page.tsx",
  "src/app/registro/estado/page.tsx",
  "src/app/invitacion/[token]/page.tsx",
  "src/app/unirse/[token]/page.tsx",
  "src/app/onboarding/[token]/page.tsx",
  "src/app/admin/login/page.tsx",
  // Las legales usan el armazón común, que lleva la clase.
  "src/app/_legal/PaginaLegal.tsx",
];

describe("pantallas de entrada en claro", () => {
  it("la regla existe y cuelga de :root", () => {
    const css = leer("src/app/globals.css");
    // `:root:has(…)` y no `.pantalla-acceso` a secas: los tokens se declaran en
    // `:root`, así que el `color-scheme` tiene que cambiar ahí.
    expect(css).toMatch(/:root:has\(\.pantalla-acceso\)\s*\{[^}]*color-scheme:\s*light/);
  });

  it("todas las pantallas de entrada llevan la clase", () => {
    const sinClase = PANTALLAS.filter((p) => !leer(p).includes("pantalla-acceso"));
    expect(sinClase).toEqual([]);
  });

  it("no se le cuela a un área con conmutador de aspecto", () => {
    // Dentro de /pro y /app manda la preferencia del usuario. Si la clase
    // apareciera ahí, el conmutador dejaría de hacer nada en modo oscuro.
    for (const ruta of ["src/app/pro/layout.tsx", "src/app/app/layout.tsx"]) {
      expect(leer(ruta)).not.toContain("pantalla-acceso");
    }
  });
});
