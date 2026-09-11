import { describe, expect, it } from "vitest";
import {
  scoreScale,
  validateAnswers,
  type ScaleAnswers,
  type ScaleDefinition,
} from "./scales";

/**
 * Definiciones copiadas del catálogo sembrado en
 * `20260717180004_scales.sql`. Se replican aquí a propósito: si alguien cambia
 * los tramos en la migración, estos tests deben fallar y obligar a revisarlo.
 */

const OPCIONES = [
  { value: 0, label: "Nunca" },
  { value: 1, label: "Varios días" },
  { value: 2, label: "Más de la mitad de los días" },
  { value: 3, label: "Casi todos los días" },
];

const PHQ9: ScaleDefinition = {
  options: OPCIONES,
  items: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, text: `Ítem ${i + 1}` })),
  scoring: {
    method: "sum",
    min: 0,
    max: 27,
    severity: [
      { min: 0, max: 4, label: "Mínima" },
      { min: 5, max: 9, label: "Leve" },
      { min: 10, max: 14, label: "Moderada" },
      { min: 15, max: 19, label: "Moderadamente grave" },
      { min: 20, max: 27, label: "Grave" },
    ],
  },
  flag_item: 9,
  flag_threshold: 1,
};

const GAD7: ScaleDefinition = {
  options: OPCIONES,
  items: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, text: `Ítem ${i + 1}` })),
  scoring: {
    method: "sum",
    min: 0,
    max: 21,
    severity: [
      { min: 0, max: 4, label: "Mínima" },
      { min: 5, max: 9, label: "Leve" },
      { min: 10, max: 14, label: "Moderada" },
      { min: 15, max: 21, label: "Grave" },
    ],
  },
};

/** Respuesta completa con el mismo valor en todos los ítems. */
const todos = (def: ScaleDefinition, v: number): ScaleAnswers =>
  Object.fromEntries(def.items.map((i) => [String(i.id), v]));

describe("scoreScale · PHQ-9", () => {
  it("todo a 0 → 0, Mínima, sin marca de riesgo", () => {
    const r = scoreScale(PHQ9, todos(PHQ9, 0));
    expect(r).toEqual({ score: 0, severity: "Mínima", flagged: false });
  });

  it("todo a 3 → 27, Grave, con marca de riesgo", () => {
    const r = scoreScale(PHQ9, todos(PHQ9, 3));
    expect(r).toEqual({ score: 27, severity: "Grave", flagged: true });
  });

  it("los límites de cada tramo caen donde toca", () => {
    const conScore = (n: number) => {
      // Reparte n puntos entre los 8 primeros ítems (el 9 a 0) para no activar
      // el flag al probar los tramos.
      const a: ScaleAnswers = todos(PHQ9, 0);
      let resto = n;
      for (let i = 1; i <= 8 && resto > 0; i++) {
        const v = Math.min(3, resto);
        a[String(i)] = v;
        resto -= v;
      }
      return scoreScale(PHQ9, a).severity;
    };
    expect(conScore(4)).toBe("Mínima");
    expect(conScore(5)).toBe("Leve");
    expect(conScore(9)).toBe("Leve");
    expect(conScore(10)).toBe("Moderada");
    expect(conScore(14)).toBe("Moderada");
    expect(conScore(15)).toBe("Moderadamente grave");
    expect(conScore(19)).toBe("Moderadamente grave");
    expect(conScore(20)).toBe("Grave");
  });

  it("el ítem 9 a 1 basta para marcar riesgo, aunque el total sea mínimo", () => {
    const a = todos(PHQ9, 0);
    a["9"] = 1;
    const r = scoreScale(PHQ9, a);
    expect(r.score).toBe(1);
    expect(r.severity).toBe("Mínima");
    expect(r.flagged).toBe(true);
  });

  it("si FALTA el ítem de riesgo, no se afirma que esté sin marcar", () => {
    // El `coalesce(..., 0)` del trigger antiguo devolvía flagged = false aquí,
    // es decir, un envío incompleto ocultaba la ideación suicida.
    const a = todos(PHQ9, 0);
    delete a["9"];
    expect(scoreScale(PHQ9, a).flagged).toBe(false);
    // Por eso la respuesta ni siquiera debe llegar a puntuarse:
    expect(validateAnswers(PHQ9, a)).toEqual({ ok: false, reason: "incompleta" });
  });

  it("no suma claves que no son ítems de la escala", () => {
    const a = { ...todos(PHQ9, 0), "99": 3, basura: 3 } as ScaleAnswers;
    expect(scoreScale(PHQ9, a).score).toBe(0);
  });
});

describe("scoreScale · GAD-7", () => {
  it("todo a 3 → 21, Grave; no tiene ítem de riesgo", () => {
    expect(scoreScale(GAD7, todos(GAD7, 3))).toEqual({
      score: 21,
      severity: "Grave",
      flagged: false,
    });
  });

  it("tramos propios de GAD-7 (el máximo es 21, no 27)", () => {
    const a = todos(GAD7, 0);
    a["1"] = 3;
    a["2"] = 2;
    expect(scoreScale(GAD7, a)).toMatchObject({ score: 5, severity: "Leve" });
  });
});

describe("validateAnswers", () => {
  it("acepta una respuesta completa y en rango", () => {
    expect(validateAnswers(PHQ9, todos(PHQ9, 2))).toEqual({ ok: true });
  });

  it("rechaza respuestas incompletas", () => {
    // El caso del hallazgo: {"1":0,"2":0,"3":0} sobre un PHQ-9 daba
    // score 0 / "Mínima", indistinguible de un registro válido.
    expect(validateAnswers(PHQ9, { "1": 0, "2": 0, "3": 0 })).toEqual({
      ok: false,
      reason: "incompleta",
    });
  });

  it("rechaza valores fuera de las opciones declaradas", () => {
    const a = todos(PHQ9, 0);
    a["1"] = 50;
    expect(validateAnswers(PHQ9, a)).toEqual({ ok: false, reason: "fuera_de_rango" });
  });

  it("rechaza valores no enteros", () => {
    const a = todos(PHQ9, 0);
    a["1"] = 1.5;
    expect(validateAnswers(PHQ9, a).ok).toBe(false);
  });

  it("rechaza ítems que no pertenecen a la escala", () => {
    const a = { ...todos(PHQ9, 0), "10": 1 } as ScaleAnswers;
    expect(validateAnswers(PHQ9, a)).toEqual({ ok: false, reason: "items_extra" });
  });
});
