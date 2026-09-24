import { describe, expect, it } from "vitest";
import { resumirAnalitica, type EntradaAnalitica, type FilaCita } from "./analitica";

// Jueves 24 de septiembre de 2026, 12:00 en Madrid (CEST, UTC+2).
const AHORA = new Date("2026-09-24T10:00:00Z");

function base(parcial: Partial<EntradaAnalitica> = {}): EntradaAnalitica {
  return {
    pacientes: [],
    citas: [],
    cobradoPorMes: [],
    pendienteCents: 0,
    conEscalaActiva: new Set(),
    respuestasEscala: [],
    riesgoSinRevisar: 0,
    entradasDiario: [],
    tareas: [],
    tareasCompletadas: [],
    ...parcial,
  };
}
function cita(inicioISO: string, extra: Partial<FilaCita> = {}): FilaCita {
  const fin = new Date(new Date(inicioISO).getTime() + 3_600_000).toISOString();
  return {
    patient_id: "p1",
    starts_at: inicioISO,
    ends_at: fin,
    status: "completed",
    attendance: "attended",
    ...extra,
  };
}

describe("resumirAnalitica", () => {
  it("cuenta sesiones realizadas y horas por mes en hora de Madrid", () => {
    const a = resumirAnalitica(
      base({
        citas: [
          cita("2026-09-10T08:00:00Z"),
          cita("2026-09-11T08:00:00Z"),
          // 31 de agosto a las 23:30 en Madrid: es agosto aunque en UTC sea el 31.
          cita("2026-08-31T21:30:00Z"),
          // 1 de septiembre a las 00:30 en Madrid: en UTC todavía es 31 de agosto.
          cita("2026-08-31T22:30:00Z"),
          cita("2026-09-12T08:00:00Z", { attendance: "no_show" }),
        ],
      }),
      AHORA,
    );
    expect(a.sesiones.esteMes).toBe(3);
    expect(a.sesiones.mesAnterior).toBe(1);
    expect(a.sesiones.horasEsteMes).toBe(3);
  });

  it("la asistencia no cuenta las canceladas ni las pendientes de marcar", () => {
    const a = resumirAnalitica(
      base({
        citas: [
          cita("2026-09-01T08:00:00Z"),
          cita("2026-09-02T08:00:00Z"),
          cita("2026-09-03T08:00:00Z"),
          cita("2026-09-04T08:00:00Z", { attendance: "no_show" }),
          cita("2026-09-05T08:00:00Z", { status: "cancelled", attendance: "pending" }),
          cita("2026-09-06T08:00:00Z", { status: "confirmed", attendance: "pending" }),
          // Futura: no entra en la asistencia.
          cita("2026-09-30T08:00:00Z", { status: "confirmed", attendance: "pending" }),
        ],
      }),
      AHORA,
    );
    expect(a.asistencia).toMatchObject({ acudio: 3, noAcudio: 1, cancelada: 1, sinMarcar: 1 });
    expect(a.asistencia.tasa).toBe(0.75);
  });

  it("sin asistencia registrada, la tasa es null y no un 0 %", () => {
    expect(resumirAnalitica(base(), AHORA).asistencia.tasa).toBeNull();
  });

  it("doce semanas terminadas en la actual, con las vacías a cero", () => {
    const a = resumirAnalitica(
      base({
        citas: [
          cita("2026-09-21T08:00:00Z", { status: "confirmed", attendance: "pending" }),
          cita("2026-09-25T08:00:00Z", { status: "confirmed", attendance: "pending" }),
          cita("2026-09-22T08:00:00Z", { status: "cancelled", attendance: "pending" }),
        ],
      }),
      AHORA,
    );
    expect(a.semanas).toHaveLength(12);
    expect(a.semanas.at(-1)).toMatchObject({ inicioYMD: "2026-09-21", sesiones: 2, enCurso: true });
    expect(a.semanas[0]!.inicioYMD).toBe("2026-07-06");
    expect(a.semanas.slice(0, -1).every((s) => s.sesiones === 0)).toBe(true);
  });

  it("reparte lo ya pasado por día de la semana y por franja", () => {
    const a = resumirAnalitica(
      base({
        citas: [
          cita("2026-09-21T07:00:00Z"), // lunes 09:00
          cita("2026-09-22T15:00:00Z"), // martes 17:00
          cita("2026-09-22T16:00:00Z"), // martes 18:00
          cita("2026-09-28T07:00:00Z", { status: "confirmed", attendance: "pending" }), // futura
        ],
      }),
      AHORA,
    );
    expect(a.porDia.map((d) => d.sesiones)).toEqual([1, 2, 0, 0, 0, 0]);
    expect(a.franjas).toEqual({ manana: 1, tarde: 2 });
  });

  it("sin próxima cita: solo activos, y solo cuenta una cita futura viva", () => {
    const a = resumirAnalitica(
      base({
        pacientes: [
          { id: "p1", status: "active", created_at: "2026-01-01T00:00:00Z", tieneCuenta: true },
          { id: "p2", status: "active", created_at: "2026-09-02T00:00:00Z", tieneCuenta: false },
          { id: "p3", status: "archived", created_at: "2026-01-01T00:00:00Z", tieneCuenta: true },
        ],
        citas: [
          cita("2026-09-30T08:00:00Z", { patient_id: "p1", status: "confirmed", attendance: "pending" }),
          cita("2026-09-30T09:00:00Z", { patient_id: "p2", status: "cancelled", attendance: "pending" }),
        ],
      }),
      AHORA,
    );
    expect(a.pacientes).toEqual({
      activos: 2,
      archivados: 1,
      nuevosEsteMes: 1,
      conCuenta: 1,
      sinProximaCita: 1,
    });
  });

  it("seis meses de cobros, con los vacíos a cero y el actual marcado", () => {
    const a = resumirAnalitica(
      base({
        cobradoPorMes: [
          { month: "2026-09", paidCents: 104_000 },
          { month: "2026-07", paidCents: 6_000 },
        ],
      }),
      AHORA,
    );
    expect(a.meses.map((m) => m.mes)).toEqual([
      "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    ]);
    expect(a.meses.find((m) => m.mes === "2026-08")!.cents).toBe(0);
    expect(a.meses.at(-1)!.enCurso).toBe(true);
    expect(a.dinero).toMatchObject({ esteMes: 104_000, mesAnterior: 0 });
  });

  it("el uso de la aplicación mira solo a los activos y los últimos 30 días", () => {
    const a = resumirAnalitica(
      base({
        pacientes: [
          { id: "p1", status: "active", created_at: "2026-01-01T00:00:00Z", tieneCuenta: true },
          { id: "p3", status: "archived", created_at: "2026-01-01T00:00:00Z", tieneCuenta: true },
        ],
        entradasDiario: [
          { patient_id: "p1", created_at: "2026-09-20T08:00:00Z" },
          { patient_id: "p1", created_at: "2026-09-21T08:00:00Z" },
          { patient_id: "p3", created_at: "2026-09-21T08:00:00Z" },
          { patient_id: "p1", created_at: "2026-07-01T08:00:00Z" },
        ],
        tareas: [
          { id: "t1", patient_id: "p1", created_at: "2026-09-10T08:00:00Z" },
          { id: "t2", patient_id: "p1", created_at: "2026-09-11T08:00:00Z" },
          { id: "t3", patient_id: "p3", created_at: "2026-09-11T08:00:00Z" },
        ],
        tareasCompletadas: [
          { task_id: "t1", completed_at: "2026-09-12T08:00:00Z" },
          { task_id: "t3", completed_at: "2026-09-12T08:00:00Z" },
        ],
        conEscalaActiva: new Set(["p1", "p3"]),
      }),
      AHORA,
    );
    expect(a.app).toMatchObject({
      activos: 1,
      activosConCuenta: 1,
      usanDiario: 1,
      tareasAsignadas: 2,
      tareasCompletadas: 1,
      conEscalaActiva: 1,
    });
  });
});
