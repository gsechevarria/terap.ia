import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * El CSS de la app del paciente NO puede tocar nada fuera de `.tp-app`.
 *
 * Es la misma lección que dejó la portada: Next conserva el CSS ya cargado al
 * navegar por cliente, así que un solo selector desnudo —`body`, `button`,
 * `svg`, `h1`— basta para repintar el panel del profesional con solo haber
 * pasado antes por la app del paciente. La maqueta de la que sale este diseño
 * traía varios, porque estaba pensada para una página autónoma.
 *
 * Esta prueba no comprueba estética: comprueba que el aislamiento sigue ahí.
 */
const CSS = readFileSync(
  fileURLToPath(new URL("../app/app/_ui/patient.css", import.meta.url)),
  "utf8",
);

/** Selectores del fichero, sin comentarios, at-rules ni pasos de keyframes. */
function selectores(css: string): string[] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const encontrados: string[] = [];
  const re = /(?:^|\}|\{)\s*([^{}]+?)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(limpio))) {
    for (const parte of (m[1] ?? "").split(",")) {
      const s = parte.trim();
      // Las at-rules (`@media`, `@keyframes`) y los pasos de keyframes no son
      // selectores: preceden a un `{` pero no aplican estilo a nada.
      if (!s || s.startsWith("@") || /^(from|to|\d+%)$/.test(s)) continue;
      encontrados.push(s);
    }
  }
  return encontrados;
}

describe("CSS de la app del paciente", () => {
  const lista = selectores(CSS);

  it("declara selectores (la prueba serviría de poco sobre un fichero vacío)", () => {
    expect(lista.length).toBeGreaterThan(100);
  });

  it("no tiene ni un selector fuera de .tp-app", () => {
    // Permitido: `.tp-…` y `.dark .tp-…` / `.light .tp-…`, que es como el
    // conmutador de aspecto reasigna los tokens.
    const fugas = lista.filter(
      (s) => !/^\.tp-/.test(s) && !/^\.(dark|light)\s+\.tp-/.test(s),
    );
    expect(fugas).toEqual([]);
  });

  it("no redefine variables de globals.css", () => {
    // Las variables propias van con prefijo `--tp-`. Declarar `--ink`, `--line`
    // o `--accent` aquí las cambiaría para todo lo que herede de este árbol,
    // incluidos los componentes compartidos con el panel del profesional.
    const declaradas = [...CSS.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map(
      (m) => m[1] ?? "",
    );
    const invasoras = [...new Set(declaradas)].filter(
      (v) => !v.startsWith("--tp-"),
    );
    expect(invasoras).toEqual([]);
  });

  it("respeta el área segura inferior de iOS", () => {
    // La barra de pestañas va pegada abajo: sin esto, el indicador de inicio
    // del iPhone se come la fila de iconos.
    expect(CSS).toContain("env(safe-area-inset-bottom");
  });
});
