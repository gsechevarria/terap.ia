import { describe, expect, it } from "vitest";
import {
  describeFrecuencia,
  diaSemanaMadrid,
  medicamentoSchema,
  pautaDeHoy,
  vigente,
  type Medicamento,
} from "@/lib/medicacion";

const base: Medicamento = {
  id: "a",
  nombre: "Fármaco A",
  dosis: "1 comprimido",
  momentos: ["manana"],
  horario: null,
  frecuencia: "diaria",
  dias_semana: [],
  con_comida: "indiferente",
  instrucciones: null,
  prescrito_por: "Dra. Ficticia",
  fecha_inicio: null,
  fecha_fin: null,
  retirada_at: null,
};

// Martes 6-oct-2026, 23:30 en Madrid (21:30 UTC).
const martesNoche = new Date("2026-10-06T21:30:00.000Z");
// Domingo 4-oct-2026 a las 23:30 UTC ya es lunes 5 en Madrid.
const lunesMadrugada = new Date("2026-10-04T23:30:00.000Z");

describe("pauta de medicación", () => {
  it("el día de la semana se resuelve en Madrid, no en UTC", () => {
    expect(diaSemanaMadrid(martesNoche)).toBe(2);
    expect(diaSemanaMadrid(lunesMadrugada)).toBe(1);
  });

  it("valida y normaliza el formulario", () => {
    const r = medicamentoSchema.parse({
      nombre: "  Fármaco  ",
      dosis: "50 mg",
      momentos: ["noche", "manana", "noche"],
      frecuencia: "diaria",
      dias_semana: [3],
      con_comida: "con_comida",
      prescrito_por: "Dr. X",
      instrucciones: "  ",
      fecha_inicio: "",
    });
    expect(r.nombre).toBe("Fármaco");
    expect(r.momentos).toEqual(["manana", "noche"]);
    // Los días solo se guardan con frecuencia semanal.
    expect(r.dias_semana).toEqual([]);
    expect(r.instrucciones).toBeNull();
    expect(r.fecha_inicio).toBeNull();
  });

  it("exige prescriptor, momento si la pauta es fija y días si es semanal", () => {
    const ok = { nombre: "F", dosis: "1", momentos: ["manana"], frecuencia: "diaria", con_comida: "indiferente", prescrito_por: "Dr. X" };
    expect(medicamentoSchema.safeParse({ ...ok, prescrito_por: " " }).success).toBe(false);
    expect(medicamentoSchema.safeParse({ ...ok, momentos: [] }).success).toBe(false);
    expect(medicamentoSchema.safeParse({ ...ok, frecuencia: "dias_semana" }).success).toBe(false);
    expect(medicamentoSchema.safeParse({ ...ok, momentos: [], frecuencia: "si_precisa" }).success).toBe(true);
    expect(
      medicamentoSchema.safeParse({ ...ok, fecha_inicio: "2026-10-10", fecha_fin: "2026-10-01" }).success,
    ).toBe(false);
  });

  it("vigente: ni retirado ni fuera de fechas", () => {
    expect(vigente(base, martesNoche)).toBe(true);
    expect(vigente({ ...base, retirada_at: "2026-10-01T00:00:00Z" }, martesNoche)).toBe(false);
    expect(vigente({ ...base, fecha_inicio: "2026-10-07" }, martesNoche)).toBe(false);
    expect(vigente({ ...base, fecha_fin: "2026-10-05" }, martesNoche)).toBe(false);
    expect(vigente({ ...base, fecha_fin: "2026-10-06" }, martesNoche)).toBe(true);
  });

  it("lo de hoy, agrupado por momento y sin los de «si hace falta»", () => {
    const lista: Medicamento[] = [
      { ...base, id: "noche", momentos: ["noche"] },
      { ...base, id: "dos", momentos: ["manana", "noche"] },
      { ...base, id: "martes", frecuencia: "dias_semana", dias_semana: [2] },
      { ...base, id: "lunes", frecuencia: "dias_semana", dias_semana: [1] },
      { ...base, id: "rescate", frecuencia: "si_precisa", momentos: [] },
      { ...base, id: "retirado", retirada_at: "2026-10-01T00:00:00Z" },
    ];
    const hoy = pautaDeHoy(lista, martesNoche);
    expect(hoy.map((t) => [t.momento, t.medicamentos.map((m) => m.id)])).toEqual([
      ["manana", ["dos", "martes"]],
      ["noche", ["noche", "dos"]],
    ]);
  });

  it("describe la frecuencia en palabras", () => {
    expect(describeFrecuencia(base)).toBe("Todos los días");
    expect(describeFrecuencia({ frecuencia: "dias_semana", dias_semana: [5, 1, 3] })).toBe(
      "Lunes, miércoles y viernes",
    );
    expect(describeFrecuencia({ frecuencia: "si_precisa", dias_semana: [] })).toBe("Solo si hace falta");
  });
});
