import { describe, expect, it } from "vitest";
import { layoutDay, type LayoutInput } from "./appointment-layout";

/** Los mismos valores que usa la agenda: 07:00-21:00, 48 px por hora. */
const OPTS = { hourStart: 7, hourEnd: 21, hourPx: 48 } as const;

const cita = (id: string, desde: string, hasta: string): LayoutInput => {
  const min = (hhmm: string) => {
    const p = hhmm.split(":");
    return Number(p[0]) * 60 + Number(p[1]);
  };
  return { id, startMin: min(desde), endMin: min(hasta) };
};

describe("layoutDay", () => {
  it("sin citas devuelve una lista vacía", () => {
    expect(layoutDay([], OPTS)).toEqual([]);
  });

  it("una cita ocupa todo el ancho y se posiciona por su hora", () => {
    const [box] = layoutDay([cita("a", "09:00", "10:00")], OPTS);
    expect(box!.leftPct).toBe(0);
    expect(box!.widthPct).toBe(100);
    expect(box!.top).toBe(2 * 48); // dos horas desde las 07:00
    expect(box!.height).toBe(48 - 2);
  });

  it("dos citas idénticas se reparten el ancho a la mitad", () => {
    const boxes = layoutDay(
      [cita("a", "09:00", "10:00"), cita("b", "09:00", "10:00")],
      OPTS,
    );
    expect(boxes.map((b) => b.widthPct)).toEqual([50, 50]);
    expect(boxes.map((b) => b.leftPct)).toEqual([0, 50]);
  });

  it("citas consecutivas sin solape comparten carril y ocupan todo el ancho", () => {
    const boxes = layoutDay(
      [cita("a", "09:00", "10:00"), cita("b", "10:00", "11:00")],
      OPTS,
    );
    expect(boxes.every((b) => b.widthPct === 100)).toBe(true);
    expect(boxes.every((b) => b.leftPct === 0)).toBe(true);
  });

  it("cadena A-B / B-C sin solape A-C: bastan dos carriles", () => {
    // A 09:00-10:00, B 09:30-10:30, C 10:00-11:00.
    // A y C no se pisan, así que C reutiliza el carril de A.
    const boxes = layoutDay(
      [
        cita("a", "09:00", "10:00"),
        cita("b", "09:30", "10:30"),
        cita("c", "10:00", "11:00"),
      ],
      OPTS,
    );
    const porId = Object.fromEntries(boxes.map((b) => [b.id, b]));
    expect(boxes.every((b) => b.widthPct === 50)).toBe(true);
    expect(porId.a!.leftPct).toBe(0);
    expect(porId.b!.leftPct).toBe(50);
    expect(porId.c!.leftPct).toBe(0); // reutiliza el carril de A
  });

  it("recorta una cita que empieza antes de las 07:00", () => {
    const [box] = layoutDay([cita("a", "06:00", "08:00")], OPTS);
    expect(box!.top).toBe(0); // no se sale por arriba
    expect(box!.height).toBe(48 - 2); // solo la hora visible
  });

  it("recorta una cita que termina después de las 21:00", () => {
    const [box] = layoutDay([cita("a", "20:00", "23:00")], OPTS);
    expect(box!.top).toBe(13 * 48);
    expect(box!.height).toBe(48 - 2);
  });

  it("descarta lo que queda completamente fuera de la ventana", () => {
    expect(layoutDay([cita("a", "02:00", "05:00")], OPTS)).toEqual([]);
    expect(layoutDay([cita("a", "22:00", "23:00")], OPTS)).toEqual([]);
  });

  it("una cita muy corta conserva un alto mínimo pinchable", () => {
    const [box] = layoutDay([cita("a", "09:00", "09:10")], OPTS);
    expect(box!.height).toBeGreaterThanOrEqual(18);
  });

  it("el orden de entrada no cambia el reparto", () => {
    const entrada = [
      cita("c", "10:00", "11:00"),
      cita("a", "09:00", "10:00"),
      cita("b", "09:30", "10:30"),
    ];
    const boxes = layoutDay(entrada, OPTS);
    const porId = Object.fromEntries(boxes.map((b) => [b.id, b]));
    expect(porId.a!.leftPct).toBe(0);
    expect(porId.b!.leftPct).toBe(50);
    expect(porId.c!.leftPct).toBe(0);
  });

  it("tres citas simultáneas se reparten en tercios", () => {
    const boxes = layoutDay(
      [
        cita("a", "09:00", "10:00"),
        cita("b", "09:00", "10:00"),
        cita("c", "09:00", "10:00"),
      ],
      OPTS,
    );
    expect(boxes.map((b) => Math.round(b.widthPct))).toEqual([33, 33, 33]);
  });
});
