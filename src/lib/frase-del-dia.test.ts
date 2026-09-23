import { describe, expect, it } from "vitest";
import {
  duracionEnPalabras,
  fraseDelDia,
  saludo,
  sinTratamiento,
  tratamientoYNombre,
} from "@/lib/frase-del-dia";

const base = {
  sesiones: 0,
  primera: null as number | null,
  ultima: null as number | null,
  huecos: [] as { desde: number; minutos: number }[],
  sinConfirmar: 0,
};

describe("saludo", () => {
  it("cambia con la franja horaria y usa el nombre de pila", () => {
    expect(saludo(9 * 60, "Laura Martín Ruiz")).toBe("Buenos días, Laura");
    expect(saludo(16 * 60, "Laura")).toBe("Buenas tardes, Laura");
    expect(saludo(22 * 60, "Laura")).toBe("Buenas noches, Laura");
    expect(saludo(3 * 60, "Laura")).toBe("Buenas noches, Laura");
  });

  it("sin nombre no deja una coma colgando", () => {
    expect(saludo(9 * 60, null)).toBe("Buenos días");
    expect(saludo(9 * 60, "   ")).toBe("Buenos días");
  });

  it("saluda a la persona, no a su tratamiento", () => {
    // El caso que lo motivó: «Buenas noches, Dra.» saludaba al título.
    expect(saludo(22 * 60, "Dra. Ana Romero")).toBe("Buenas noches, Dra. Ana");
  });
});

describe("tratamientoYNombre", () => {
  it("conserva el tratamiento y añade el nombre de pila", () => {
    expect(tratamientoYNombre("Dra. Ana Romero")).toBe("Dra. Ana");
    expect(tratamientoYNombre("Dr. Juan Pérez Gil")).toBe("Dr. Juan");
    expect(tratamientoYNombre("Lic. Marta Ruiz")).toBe("Lic. Marta");
    expect(tratamientoYNombre("Prof. Elena Sanz")).toBe("Prof. Elena");
  });

  it("no depende del punto ni de las mayúsculas", () => {
    expect(tratamientoYNombre("dra ana romero")).toBe("dra ana");
    expect(tratamientoYNombre("DRA. ANA ROMERO")).toBe("DRA. ANA");
  });

  it("sin tratamiento delante, el nombre de pila a secas", () => {
    expect(tratamientoYNombre("Ana Romero")).toBe("Ana");
    expect(tratamientoYNombre("Laura")).toBe("Laura");
  });

  it("si solo consta el tratamiento, se usa: es lo único que hay", () => {
    expect(tratamientoYNombre("Dra.")).toBe("Dra.");
  });

  it("aguanta lo que venga mal escrito", () => {
    expect(tratamientoYNombre(null)).toBe("");
    expect(tratamientoYNombre("   ")).toBe("");
    expect(tratamientoYNombre("  Dra.   Ana   Romero  ")).toBe("Dra. Ana");
  });
});

describe("duracionEnPalabras", () => {
  it("dice las duraciones redondas como se dicen en voz alta", () => {
    expect(duracionEnPalabras(90)).toBe("hora y media");
    expect(duracionEnPalabras(60)).toBe("una hora");
    expect(duracionEnPalabras(120)).toBe("2 horas");
    expect(duracionEnPalabras(150)).toBe("2 horas y media");
    expect(duracionEnPalabras(45)).toBe("45 minutos");
    expect(duracionEnPalabras(100)).toBe("1 h 40 min");
  });
});

describe("fraseDelDia", () => {
  it("describe la jornada con su primera y su última hora", () => {
    expect(
      fraseDelDia({ ...base, sesiones: 5, primera: 10 * 60, ultima: 19 * 60 }),
    ).toBe("Hoy tienes 5 sesiones entre las 10:00 y las 19:00.");
  });

  it("concuerda el singular", () => {
    expect(fraseDelDia({ ...base, sesiones: 1, primera: 10 * 60, ultima: 11 * 60 })).toBe(
      "Hoy tienes una sesión, a las 10:00.",
    );
  });

  it("lo dice cuando el día está vacío, sin adornos", () => {
    expect(fraseDelDia(base)).toBe("Hoy no tienes ninguna sesión agendada.");
  });

  it("menciona el hueco mayor y las citas sin confirmar", () => {
    expect(
      fraseDelDia({
        ...base,
        sesiones: 5,
        primera: 10 * 60,
        ultima: 19 * 60,
        huecos: [
          { desde: 11 * 60, minutos: 30 },
          { desde: 14 * 60 + 30, minutos: 90 },
        ],
        sinConfirmar: 1,
      }),
    ).toBe(
      "Hoy tienes 5 sesiones entre las 10:00 y las 19:00. Queda un hueco de hora y media por la tarde y una cita sin confirmar.",
    );
  });

  it("ignora los huecos que no dan para nada", () => {
    // Quince minutos entre dos sesiones no son un hueco, son el cambio de
    // paciente. Decirlo sería llenar la frase de ruido.
    const f = fraseDelDia({
      ...base,
      sesiones: 2,
      primera: 10 * 60,
      ultima: 12 * 60,
      huecos: [{ desde: 11 * 60, minutos: 15 }],
    });
    expect(f).toBe("Hoy tienes 2 sesiones entre las 10:00 y las 12:00.");
  });

  it("no habla de huecos si no hay ninguna sesión", () => {
    const f = fraseDelDia({ ...base, huecos: [{ desde: 9 * 60, minutos: 480 }] });
    expect(f).toBe("Hoy no tienes ninguna sesión agendada.");
  });

  it("nombra el momento del día del hueco", () => {
    expect(
      fraseDelDia({
        ...base,
        sesiones: 3,
        primera: 9 * 60,
        ultima: 14 * 60,
        huecos: [{ desde: 10 * 60, minutos: 60 }],
      }),
    ).toContain("una hora por la mañana");
  });

  it("no interpreta ni aconseja", () => {
    const f = fraseDelDia({
      ...base,
      sesiones: 8,
      primera: 8 * 60,
      ultima: 21 * 60,
      sinConfirmar: 3,
    });
    for (const prohibida of ["aprovecha", "deberías", "descansa", "demasiado", "cuidado"]) {
      expect(f.toLowerCase()).not.toContain(prohibida);
    }
    expect(f).toBe("Hoy tienes 8 sesiones entre las 08:00 y las 21:00. 3 citas sin confirmar.");
  });
});

describe("sinTratamiento", () => {
  it("quita el tratamiento y deja el nombre completo", () => {
    expect(sinTratamiento("Dra. Ana Romero")).toBe("Ana Romero");
    expect(sinTratamiento("Dr. Juan Pérez Gil")).toBe("Juan Pérez Gil");
  });

  it("deja intacto lo que no lleva tratamiento", () => {
    expect(sinTratamiento("Ana Romero")).toBe("Ana Romero");
    expect(sinTratamiento("Laura")).toBe("Laura");
  });

  it("si solo hay tratamiento, lo devuelve en vez de vaciarlo", () => {
    expect(sinTratamiento("Dra.")).toBe("Dra.");
  });

  it("aguanta lo vacío y los espacios de más", () => {
    expect(sinTratamiento(null)).toBe("");
    expect(sinTratamiento("  Dra.   Ana   Romero ")).toBe("Ana Romero");
  });
});
