import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CONFIRMACION_GUARDADO,
  mensajeDeApoyo,
  todosLosMensajes,
} from "@/app/app/_ui/apoyo";

/**
 * Los mensajes de apoyo del diario.
 *
 * Se prueban dos cosas distintas y las dos importan:
 *
 *  1. **Qué dicen.** Son las frases que lee alguien que acaba de decir que
 *     está mal. Una promesa vacía o un «no es para tanto» hacen daño, y una
 *     recomendación de tratamiento saca el producto del alcance declarado.
 *  2. **Cómo se eligen.** Sin analizar la nota, sin servicios externos y de
 *     forma estable: la frase no puede bailar mientras la persona escribe.
 */

const fuente = readFileSync(
  fileURLToPath(new URL("../app/app/_ui/apoyo.ts", import.meta.url)),
  "utf8",
);

/**
 * El fichero sin comentarios. Las comprobaciones sobre el código miran esto:
 * el comentario de cabecera explica precisamente que la nota NO se analiza, y
 * buscar la palabra «nota» en el texto del comentario daba un falso positivo.
 */
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("catálogo de mensajes de apoyo", () => {
  it("«Mal» y «Regular» tienen mensaje", () => {
    expect(mensajeDeApoyo(1, 4, "2026-09-19")).toBeTruthy();
    expect(mensajeDeApoyo(2, 4, "2026-09-19")).toBeTruthy();
  });

  it("«Bien» y «Muy bien» NO llevan mensaje antes de guardar", () => {
    // Acompañar a quien está mal no es lo mismo que aplaudir a quien está
    // bien. Premiar esas dos respuestas convertiría el diario en algo que se
    // puede contestar bien o mal.
    expect(mensajeDeApoyo(3, 4, "2026-09-19")).toBeNull();
    expect(mensajeDeApoyo(4, 4, "2026-09-19")).toBeNull();
  });

  it("la escala antigua no recibe mensajes", () => {
    // En la escala de cinco un 1 es «Muy mal» y un 2 es «Mal»: los índices no
    // coinciden, y aplicarles este catálogo sería responder a otra cosa.
    for (let v = 1; v <= 5; v++) expect(mensajeDeApoyo(v, 5, "2026-09-19")).toBeNull();
  });

  it("la confirmación tras guardar es la misma para las cuatro opciones", () => {
    expect(CONFIRMACION_GUARDADO).toBeTruthy();
    expect(CONFIRMACION_GUARDADO).not.toMatch(/enhorabuena|felicidades|genial|bien hecho/i);
  });
});

describe("estabilidad del mensaje", () => {
  it("el mismo día y la misma opción dan siempre la misma frase", () => {
    const primera = mensajeDeApoyo(1, 4, "2026-09-19");
    for (let i = 0; i < 50; i++) {
      expect(mensajeDeApoyo(1, 4, "2026-09-19")).toBe(primera);
    }
  });

  it("no depende de la nota: la función ni siquiera la recibe", () => {
    // La firma es (valor, escala, día). Si alguien añadiera la nota como
    // argumento, esto dejaría de compilar y habría que discutirlo.
    expect(mensajeDeApoyo.length).toBe(3);
    expect(codigo).not.toMatch(/\bnota\b|\bnote\b/);
  });

  it("no hay aleatoriedad, ni red, ni modelos", () => {
    expect(codigo).not.toMatch(/Math\.random|Date\.now|new Date\(/);
    expect(codigo).not.toMatch(/fetch\(|openai|anthropic|api\./i);
    // Sin imports: el catálogo no puede depender de nada que cambie.
    expect(codigo).not.toMatch(/^\s*import\s/m);
  });

  it("cambia de un día para otro, para no repetir siempre lo mismo", () => {
    const vistos = new Set<string | null>();
    for (let d = 1; d <= 28; d++) {
      vistos.add(mensajeDeApoyo(1, 4, `2026-09-${String(d).padStart(2, "0")}`));
    }
    expect(vistos.size).toBeGreaterThan(1);
  });
});

describe("lo que ninguna frase puede decir", () => {
  /**
   * Cada patrón lleva por qué está prohibido. El negativo importa: «No tienes
   * que resolverlo todo hoy» da permiso, mientras que «Tienes que resolverlo»
   * culpa — de ahí las miradas atrás en los patrones.
   */
  const PROHIBIDO: [RegExp, string][] = [
    [/\btodo (va a |ir[áa] )?(mejor|bien)\b/i, "promete que todo mejorará"],
    [/\bya ver[áa]s\b|\bpronto (estar[áa]s|te sentir[áa]s)\b|\bsaldr[áa]s de esta\b/i, "promete un futuro que nadie puede garantizar"],
    [/\bno es para tanto\b|\bno pasa nada\b|\ban[íi]mate\b|\bno est[ée]s (triste|as[íi])\b/i, "minimiza el malestar"],
    [/(?<!no )\btienes que\b|(?<!no )\bdeber[íi]as\b|\bsi te esfuerzas\b|\bdepende de ti\b/i, "culpabiliza"],
    [/\bmedicaci[óo]n\b|\bmedicamento\b|\btratamiento\b|\bmedita\b|\brespira\b|\bhaz ejercicio\b/i, "recomienda un tratamiento"],
    [/\ben directo\b|\bahora mismo (lo )?(ve|est[áa] viendo|lee)\b|\best[áa] leyendo\b/i, "sugiere supervisión en tiempo real"],
    [/\bracha\b|\bpuntos\b|\bpremio\b|\bnivel \d|\benhorabuena\b|\bfelicidades\b/i, "gamifica el diario"],
  ];

  it("ninguna frase del catálogo cae en un patrón prohibido", () => {
    const fallos: string[] = [];
    for (const frase of todosLosMensajes()) {
      for (const [patron, motivo] of PROHIBIDO) {
        if (patron.test(frase)) fallos.push(`«${frase}» ${motivo}`);
      }
    }
    expect(fallos).toEqual([]);
  });

  it("los patrones detectan de verdad lo que dicen detectar", () => {
    // Una lista de prohibiciones que no rechaza nada es decorativa.
    const deberianFallar = [
      "Ya verás como todo mejora.",
      "No es para tanto, anímate.",
      "Deberías intentar respirar hondo.",
      "Tu profesional está leyendo esto.",
      "¡Enhorabuena! Llevas una racha de 5 días.",
    ];
    for (const frase of deberianFallar) {
      expect(PROHIBIDO.some(([p]) => p.test(frase))).toBe(true);
    }
  });

  it("y no rechazan las frases aprobadas por dar permiso en negativo", () => {
    expect(PROHIBIDO.some(([p]) => p.test("No tienes que resolverlo todo hoy."))).toBe(false);
  });
});
