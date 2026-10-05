import { describe, expect, it } from "vitest";
import {
  citaEmpezada,
  puedeEmitirJustificante,
  puedeRegistrarAsistencia,
} from "@/lib/asistencia";

const ahora = new Date("2026-10-06T09:00:00.000Z");
const pasada = "2026-10-06T08:00:00.000Z";
const futura = "2026-10-06T10:00:00.000Z";

describe("registro de asistencia", () => {
  it("la cita ha empezado desde su hora de inicio exacta", () => {
    expect(citaEmpezada(pasada, ahora)).toBe(true);
    expect(citaEmpezada(ahora.toISOString(), ahora)).toBe(true);
    expect(citaEmpezada(futura, ahora)).toBe(false);
    expect(citaEmpezada("no-es-fecha", ahora)).toBe(false);
  });

  it("no deja marcar acudió, no acudió ni canceló tarde en una cita futura", () => {
    for (const a of ["attended", "no_show", "late_cancel"] as const) {
      expect(puedeRegistrarAsistencia(a, futura, ahora)).toBe(false);
      expect(puedeRegistrarAsistencia(a, pasada, ahora)).toBe(true);
    }
  });

  it("deja volver a pendiente siempre, para deshacer un registro por error", () => {
    expect(puedeRegistrarAsistencia("pending", futura, ahora)).toBe(true);
  });

  it("el justificante exige acudió y cita empezada", () => {
    expect(puedeEmitirJustificante({ attendance: "attended", starts_at: pasada }, ahora)).toBe(true);
    // Lo que ya hay en la base de antes de la regla: marcada, pero futura.
    expect(puedeEmitirJustificante({ attendance: "attended", starts_at: futura }, ahora)).toBe(false);
    expect(puedeEmitirJustificante({ attendance: "no_show", starts_at: pasada }, ahora)).toBe(false);
  });
});
