import { describe, expect, it } from "vitest";
import {
  TZ,
  addDaysYMD,
  formatYMD,
  fromWallClock,
  lastDayOfMonth,
  minutesOfDayInTZ,
  mondayOfYMD,
  parseYMD,
  todayYMD,
  wallClockParts,
  ymdInTZ,
} from "./tz";
import { occurrenceAt, occurrenceSeries } from "./recurrence";
import { presetRange, isValidYMD, fromDateToISO, toDateToISO } from "./date-ranges";
import { resolveAgendaWindow } from "./agenda-window";

/**
 * Estos tests no fijan `process.env.TZ`: las funciones tienen que dar el mismo
 * resultado en UTC (Vercel) y en Europe/Madrid (la máquina de desarrollo), y
 * ahí estaba precisamente el fallo. El CI ejecuta la suite en UTC.
 */

const show = (d: Date) =>
  new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);

describe("fromWallClock / wallClockParts", () => {
  it("20:00 de Madrid en agosto (CEST, UTC+2)", () => {
    expect(fromWallClock(2026, 8, 7, 20, 0).toISOString()).toBe(
      "2026-08-07T18:00:00.000Z",
    );
  });

  it("20:00 de Madrid en enero (CET, UTC+1)", () => {
    expect(fromWallClock(2026, 1, 15, 20, 0).toISOString()).toBe(
      "2026-01-15T19:00:00.000Z",
    );
  });

  it("la medianoche no se lee como la hora 24", () => {
    // Con `hour12:false` y sin `hourCycle:'h23'`, algunos ICU devuelven "24".
    expect(wallClockParts(fromWallClock(2026, 8, 7, 0, 0)).hh).toBe(0);
  });

  it("ida y vuelta a ambos lados del cambio de horario", () => {
    for (const [m, d] of [
      [3, 28],
      [3, 30],
      [10, 24],
      [10, 26],
    ] as const) {
      const t = fromWallClock(2026, m, d, 10, 30);
      const p = wallClockParts(t);
      expect([p.m, p.d, p.hh, p.mm]).toEqual([m, d, 10, 30]);
    }
  });

  it("minutesOfDayInTZ cuenta desde la medianoche española", () => {
    expect(minutesOfDayInTZ(fromWallClock(2026, 8, 7, 9, 30))).toBe(570);
    expect(minutesOfDayInTZ(new Date("2026-08-07T18:00:00Z"))).toBe(20 * 60);
  });
});

describe("todayYMD / ymdInTZ", () => {
  it("a las 00:30 de España el día ya ha cambiado, aunque en UTC no", () => {
    // 2026-08-08T00:30 Madrid = 2026-08-07T22:30Z. En UTC seguiría siendo el 7.
    const instante = new Date("2026-08-07T22:30:00Z");
    expect(todayYMD(instante)).toBe("2026-08-08");
    expect(ymdInTZ(instante)).toBe("2026-08-08");
  });

  it("a las 23:30 de España sigue siendo el mismo día", () => {
    expect(todayYMD(new Date("2026-08-07T21:30:00Z"))).toBe("2026-08-07");
  });
});

describe("fechas de calendario", () => {
  it("parseYMD y formatYMD son inversas", () => {
    expect(formatYMD(parseYMD("2026-02-29"))).toBe("2026-03-01"); // 2026 no bisiesto
    expect(formatYMD(parseYMD("2028-02-29"))).toBe("2028-02-29");
  });

  it("addDaysYMD cruza el cambio de horario sin perder un día", () => {
    expect(formatYMD(addDaysYMD(parseYMD("2026-10-24"), 2))).toBe("2026-10-26");
    expect(formatYMD(addDaysYMD(parseYMD("2026-03-28"), 2))).toBe("2026-03-30");
  });

  it("mondayOfYMD", () => {
    // 2026-08-07 es viernes → lunes 2026-08-03.
    expect(formatYMD(mondayOfYMD(parseYMD("2026-08-07")))).toBe("2026-08-03");
    // Un lunes se devuelve a sí mismo.
    expect(formatYMD(mondayOfYMD(parseYMD("2026-08-03")))).toBe("2026-08-03");
    // Domingo pertenece a la semana que empieza el lunes anterior.
    expect(formatYMD(mondayOfYMD(parseYMD("2026-08-09")))).toBe("2026-08-03");
  });

  it("lastDayOfMonth", () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2028, 2)).toBe(29);
    expect(lastDayOfMonth(2026, 4)).toBe(30);
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });
});

describe("occurrenceAt", () => {
  it("semanal cruzando el FIN del horario de verano (25-oct-2026)", () => {
    const serie = occurrenceSeries(
      fromWallClock(2026, 10, 20, 10, 0),
      "weekly",
      3,
    ).map(show);
    expect(serie).toEqual([
      "20/10/2026, 10:00",
      "27/10/2026, 10:00",
      "03/11/2026, 10:00",
    ]);
  });

  it("semanal cruzando el INICIO del horario de verano (29-mar-2026)", () => {
    const serie = occurrenceSeries(
      fromWallClock(2026, 3, 25, 18, 30),
      "weekly",
      3,
    ).map(show);
    expect(serie).toEqual([
      "25/03/2026, 18:30",
      "01/04/2026, 18:30",
      "08/04/2026, 18:30",
    ]);
  });

  it("mensual desde el 31 de enero vuelve al 31 cuando el mes da", () => {
    const serie = occurrenceSeries(
      fromWallClock(2026, 1, 31, 9, 0),
      "monthly",
      4,
    ).map((d) => show(d).slice(0, 10));
    expect(serie).toEqual([
      "31/01/2026",
      "28/02/2026",
      "31/03/2026",
      "30/04/2026",
    ]);
  });

  it("mensual desde el 31 de marzo", () => {
    const serie = occurrenceSeries(
      fromWallClock(2026, 3, 31, 9, 0),
      "monthly",
      3,
    ).map((d) => show(d).slice(0, 10));
    expect(serie).toEqual(["31/03/2026", "30/04/2026", "31/05/2026"]);
  });

  it("mensual que cae en el 29 de febrero de un bisiesto", () => {
    expect(
      show(occurrenceAt(fromWallClock(2028, 1, 31, 9, 0), "monthly", 1)).slice(0, 10),
    ).toBe("29/02/2028");
  });

  it("mensual salta de año correctamente", () => {
    expect(
      show(occurrenceAt(fromWallClock(2026, 12, 31, 9, 0), "monthly", 1)).slice(0, 10),
    ).toBe("31/01/2027");
    expect(
      show(occurrenceAt(fromWallClock(2026, 12, 31, 9, 0), "monthly", 14)).slice(0, 10),
    ).toBe("29/02/2028");
  });

  it("quincenal y diaria conservan la hora de pared", () => {
    expect(show(occurrenceAt(fromWallClock(2026, 10, 20, 10, 0), "biweekly", 1))).toBe(
      "03/11/2026, 10:00",
    );
    expect(show(occurrenceAt(fromWallClock(2026, 3, 28, 10, 0), "daily", 1))).toBe(
      "29/03/2026, 10:00",
    );
  });

  it("26 ocurrencias semanales conservan la hora de punta a punta", () => {
    const serie = occurrenceSeries(
      fromWallClock(2026, 10, 1, 18, 30),
      "weekly",
      26,
    ).map(show);
    expect(serie.every((s) => s.endsWith("18:30"))).toBe(true);
  });

  it("`none` devuelve siempre la cita original", () => {
    const a = fromWallClock(2026, 8, 7, 20, 0);
    expect(occurrenceAt(a, "none", 5).toISOString()).toBe(a.toISOString());
  });
});

describe("resolveAgendaWindow", () => {
  it("la ventana de un día empieza a medianoche de MADRID, no de UTC", () => {
    const w = resolveAgendaWindow("day", "2026-08-07");
    expect(w.fromISO).toBe("2026-08-06T22:00:00.000Z");
    expect(w.toISO).toBe("2026-08-07T22:00:00.000Z");
  });

  it("la semana va de lunes a lunes", () => {
    const w = resolveAgendaWindow("week", "2026-08-07"); // viernes
    expect(w.dateYMD).toBe("2026-08-07");
    expect(w.fromISO).toBe("2026-08-02T22:00:00.000Z"); // lunes 3-ago 00:00
    expect(w.prevYMD).toBe("2026-07-31");
    expect(w.nextYMD).toBe("2026-08-14");
  });

  it("la rejilla del mes empieza en el lunes anterior al día 1", () => {
    // 1-sep-2026 es martes → la rejilla empieza el lunes 31-ago.
    const w = resolveAgendaWindow("month", "2026-09-15");
    expect(w.fromISO).toBe("2026-08-30T22:00:00.000Z");
    expect(w.prevYMD).toBe("2026-08-01");
    expect(w.nextYMD).toBe("2026-10-01");
  });

  it("cambio de año en la vista de mes", () => {
    const w = resolveAgendaWindow("month", "2026-01-15");
    expect(w.prevYMD).toBe("2025-12-01");
    const w2 = resolveAgendaWindow("month", "2026-12-15");
    expect(w2.nextYMD).toBe("2027-01-01");
  });

  it("una fecha mal formada cae en hoy sin romperse", () => {
    const w = resolveAgendaWindow("day", "no-es-fecha");
    expect(w.dateYMD).toBe(todayYMD());
  });
});

describe("date-ranges", () => {
  const ref = new Date("2026-08-07T10:00:00Z");

  it("presets calculados sobre el día español", () => {
    expect(presetRange("this-month", ref)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(presetRange("last-month", ref)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(presetRange("this-year", ref)).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(presetRange("next-30", ref)).toEqual({
      from: "2026-08-07",
      to: "2026-09-05",
    });
    expect(presetRange("last-30", ref)).toEqual({
      from: "2026-07-09",
      to: "2026-08-07",
    });
  });

  it("a las 00:30 de España el mes de referencia es el correcto", () => {
    // 2026-09-01T00:30 Madrid = 2026-08-31T22:30Z: en UTC sería agosto.
    expect(presetRange("this-month", new Date("2026-08-31T22:30:00Z"))).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("isValidYMD rechaza fechas inexistentes", () => {
    expect(isValidYMD("2026-02-28")).toBe(true);
    expect(isValidYMD("2026-02-31")).toBe(false);
    expect(isValidYMD("2026-13-01")).toBe(false);
    expect(isValidYMD("7/8/2026")).toBe(false);
    expect(isValidYMD(undefined)).toBe(false);
  });

  it("los límites del rango son medianoche de Madrid", () => {
    expect(fromDateToISO("2026-08-07")).toBe("2026-08-06T22:00:00.000Z");
    // `to` es inclusivo: se convierte al inicio del día siguiente.
    expect(toDateToISO("2026-08-07")).toBe("2026-08-07T22:00:00.000Z");
    // En invierno el desfase es de una hora.
    expect(fromDateToISO("2026-01-15")).toBe("2026-01-14T23:00:00.000Z");
  });
});
