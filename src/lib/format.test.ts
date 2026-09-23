import { describe, expect, it } from "vitest";
import { formatCuantoFalta, nombreDelDia } from "@/lib/format";

/*
 * Las fechas van en ISO con Z y se leen en Europe/Madrid, que es lo que fijan
 * todos los formateadores. En septiembre España está en CEST (UTC+2), así que
 * 15:30Z son las 17:30 de pared.
 */

describe("nombreDelDia", () => {
  it("no nombra el día cuando la cita es hoy", () => {
    // «a las 17:32» ya se entiende; añadir «hoy» sería decirlo dos veces.
    expect(nombreDelDia("2026-09-23T15:32:00Z", 0)).toBe("");
  });

  it("mañana se dice con su palabra, no con su fecha", () => {
    expect(nombreDelDia("2026-09-24T15:32:00Z", 1)).toBe("mañana");
  });

  it("dentro de la semana basta el día de la semana", () => {
    // Del miércoles 23 al lunes 28 hay cinco días: cada día de la semana
    // aparece una sola vez en esa ventana, así que no hay ambigüedad.
    expect(nombreDelDia("2026-09-28T15:32:00Z", 5)).toBe("el lunes");
    expect(nombreDelDia("2026-09-29T15:32:00Z", 6)).toBe("el martes");
  });

  it("más allá de seis días hacen falta el día y el mes", () => {
    // A siete días, «el miércoles» ya no distingue de hoy.
    expect(nombreDelDia("2026-09-30T15:32:00Z", 7)).toBe("el 30 de septiembre");
    expect(nombreDelDia("2026-10-14T15:32:00Z", 21)).toBe("el 14 de octubre");
  });
});

describe("formatCuantoFalta", () => {
  const ahora = "2026-09-23T15:00:00Z";

  it("por debajo de una hora, los minutos", () => {
    expect(formatCuantoFalta(ahora, "2026-09-23T15:24:00Z", 0)).toBe("en 24 min");
    expect(formatCuantoFalta(ahora, "2026-09-23T15:59:00Z", 0)).toBe("en 59 min");
  });

  it("el mismo día, horas y minutos", () => {
    expect(formatCuantoFalta(ahora, "2026-09-23T18:20:00Z", 0)).toBe("en 3 h 20 min");
    expect(formatCuantoFalta(ahora, "2026-09-23T18:00:00Z", 0)).toBe("en 3 h");
  });

  it("la sesión que ya ha empezado no cuenta hacia atrás", () => {
    expect(formatCuantoFalta(ahora, "2026-09-23T14:50:00Z", 0)).toBe("ahora");
    expect(formatCuantoFalta(ahora, ahora, 0)).toBe("ahora");
  });

  it("a partir de mañana se cuenta en días, no en horas", () => {
    // «en 31 h 12 min» obliga a hacer la cuenta para saber que es mañana.
    expect(formatCuantoFalta(ahora, "2026-09-24T22:12:00Z", 1)).toBe("mañana");
    expect(formatCuantoFalta(ahora, "2026-09-29T15:00:00Z", 6)).toBe("en 6 días");
    expect(formatCuantoFalta(ahora, "2026-10-14T15:00:00Z", 21)).toBe("en 21 días");
  });
});
