import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * Las pantallas abiertas se mantienen al día con `RefrescoAutomatico`
 * (hallazgos H6 y H8 de docs/SINCRONIZACION.md). Sin él, el paciente con la
 * app abierta no ve lo que le crea su profesional hasta cambiar de sección, y
 * los contadores del panel se quedan con los números de la carga.
 *
 * vitest corre en Node (sin DOM), así que se comprueba lo que se puede sin
 * navegador: que ambos layouts lo montan y que escucha lo que debe.
 */
const leer = (ruta: string) => readFileSync(ruta, "utf8");

describe("refresco de pantallas abiertas", () => {
  it.each(["src/app/app/layout.tsx", "src/app/pro/layout.tsx"])("%s monta <RefrescoAutomatico />", (ruta) => {
    expect(leer(ruta)).toMatch(/<RefrescoAutomatico\b[^>]*\/>/);
  });

  it("refresca al volver, al reconectar, desde la caché de atrás/adelante y al navegar", () => {
    const src = leer("src/components/RefrescoAutomatico.tsx");
    for (const evento of ["visibilitychange", "online", "pageshow"]) {
      expect(src).toContain(`"${evento}"`);
    }
    expect(src).toContain("router.refresh()");
    expect(src).toMatch(/usePathname\(\)/);
    expect(src).toMatch(/clearInterval/);
  });

  it("el formulario del diario se pone al día cuando cambia el registro de hoy", () => {
    const src = leer("src/app/app/_components/MoodEntryForm.tsx");
    expect(src).toMatch(/if \(firma !== firmaVista\)/);
  });
});
