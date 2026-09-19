import { describe, expect, it } from "vitest";
import { ESCALA_ACTUAL, LIMITE_NOTA, etiquetaAnimo, validarRegistro } from "@/lib/diario";

/**
 * La validación del diario, que corre en el servidor.
 *
 * Importa probarla aparte de la interfaz porque **una acción de servidor es un
 * endpoint HTTP**: el `maxLength` del textarea y el botón deshabilitado son
 * comodidad, no defensa. Quien llame a la acción a mano se salta las dos.
 */

describe("validarRegistro", () => {
  it("acepta las cuatro opciones de la escala vigente", () => {
    for (let v = 1; v <= ESCALA_ACTUAL; v++) {
      const r = validarRegistro(v, undefined);
      expect(r.ok).toBe(true);
    }
  });

  it("no deja guardar sin elegir, ni con un valor fuera de la escala", () => {
    for (const v of [null, undefined, 0, ESCALA_ACTUAL + 1, 99, -1, 2.5, "2", NaN]) {
      expect(validarRegistro(v, undefined).ok).toBe(false);
    }
  });

  it("la nota es opcional y el vacío se guarda como nulo", () => {
    for (const nota of [undefined, null, "", "   ", "\n\t "]) {
      const r = validarRegistro(2, nota);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.registro.nota).toBeNull();
    }
  });

  it("recorta los espacios de los extremos pero no el contenido", () => {
    const r = validarRegistro(3, "  hoy me he sentido raro  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.registro.nota).toBe("hoy me he sentido raro");
  });

  it("admite el límite exacto", () => {
    expect(validarRegistro(1, "x".repeat(LIMITE_NOTA)).ok).toBe(true);
  });

  it("RECHAZA pasarse del límite en vez de recortar en silencio", () => {
    // El comportamiento anterior era `slice(0, 5000)`: quien escribía de más
    // perdía el final sin enterarse. Perder texto de alguien sin decírselo es
    // peor que negarse a guardarlo.
    const r = validarRegistro(1, "x".repeat(LIMITE_NOTA + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/caracteres/);
  });

  it("rechaza una nota que no sea texto", () => {
    expect(validarRegistro(1, { html: "<b>" }).ok).toBe(false);
    expect(validarRegistro(1, 42).ok).toBe(false);
  });
});

describe("etiquetas y escalas", () => {
  it("el mismo número significa cosas distintas en cada escala", () => {
    // Este es el motivo entero de que `mood_scale` exista.
    expect(etiquetaAnimo(3, 5)).toBe("Normal");
    expect(etiquetaAnimo(3, 4)).toBe("Bien");
    expect(etiquetaAnimo(3, 5)).not.toBe(etiquetaAnimo(3, 4));
  });

  it("las cuatro opciones vigentes van de peor a mejor", () => {
    expect([1, 2, 3, 4].map((v) => etiquetaAnimo(v, 4))).toEqual([
      "Mal",
      "Regular",
      "Bien",
      "Muy bien",
    ]);
  });

  it("una escala desconocida no se inventa una etiqueta", () => {
    expect(etiquetaAnimo(2, 7)).toBe("2/7");
  });
});
