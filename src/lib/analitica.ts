import {
  addDaysYMD,
  formatYMD,
  minutesOfDayInTZ,
  mondayOfYMD,
  parseYMD,
  ymdInTZ,
} from "@/lib/tz";

/*
 * Analítica de la consulta: agregación PURA sobre filas ya leídas.
 *
 * Todo es descriptivo y operativo —agenda, asistencia, dinero y uso de la
 * aplicación—. No hay una sola cifra clínica: la antigua «evolución agregada de
 * escalas» promediaba puntuaciones de pacientes distintos, un número que no
 * describe a nadie y que se lee como tendencia clínica de la consulta. Se
 * retira. Lo único de escalas que queda es operativo: cuántos las tienen
 * activas, cuántas respuestas llegan y cuántos ítems de riesgo esperan revisión.
 *
 * Las fechas se resuelven en Madrid (`lib/tz`), nunca en la zona del proceso.
 */

export type FilaPaciente = {
  id: string;
  status: string;
  created_at: string;
  tieneCuenta: boolean;
};
export type FilaCita = {
  patient_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  attendance: string;
};
export type FilaMes = { month: string; paidCents: number };

export type EntradaAnalitica = {
  pacientes: FilaPaciente[];
  citas: FilaCita[];
  cobradoPorMes: FilaMes[];
  pendienteCents: number;
  /** Pacientes con al menos una escala activa. */
  conEscalaActiva: Set<string>;
  respuestasEscala: { patient_id: string; submitted_at: string }[];
  riesgoSinRevisar: number;
  entradasDiario: { patient_id: string; created_at: string }[];
  tareas: { id: string; patient_id: string; created_at: string }[];
  tareasCompletadas: { task_id: string; completed_at: string }[];
};

export type Analitica = {
  pacientes: {
    activos: number;
    archivados: number;
    nuevosEsteMes: number;
    conCuenta: number;
    sinProximaCita: number;
  };
  sesiones: {
    esteMes: number;
    mesAnterior: number;
    /** Horas de sesión realizadas este mes. */
    horasEsteMes: number;
  };
  /** Últimos 90 días, citas ya pasadas. */
  asistencia: {
    acudio: number;
    noAcudio: number;
    canceloTarde: number;
    cancelada: number;
    /** Pasadas sin asistencia marcada. */
    sinMarcar: number;
    /** acudió / (acudió + no acudió + canceló tarde); null sin datos. */
    tasa: number | null;
  };
  dinero: {
    esteMes: number;
    mesAnterior: number;
    pendiente: number;
  };
  semanas: { inicioYMD: string; etiqueta: string; sesiones: number; enCurso: boolean }[];
  meses: { mes: string; cents: number; enCurso: boolean }[];
  /** Lunes a sábado, últimas 12 semanas, sin canceladas. */
  porDia: { etiqueta: string; sesiones: number }[];
  franjas: { manana: number; tarde: number };
  app: {
    activosConCuenta: number;
    activos: number;
    usanDiario: number;
    tareasAsignadas: number;
    tareasCompletadas: number;
    conEscalaActiva: number;
    respuestasEscala: number;
    riesgoSinRevisar: number;
  };
};

const SEMANAS = 12;
const MESES = 6;
const DIAS_ASISTENCIA = 90;
const DIAS_USO = 30;
const DIAS = ["L", "M", "X", "J", "V", "S"];

function mesDe(iso: string): string {
  return ymdInTZ(new Date(iso)).slice(0, 7);
}
function sumarMeses(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function etiquetaSemana(lunes: Date): string {
  return `${lunes.getUTCDate()}/${lunes.getUTCMonth() + 1}`;
}

export function resumirAnalitica(e: EntradaAnalitica, ahora: Date): Analitica {
  const hoyYMD = ymdInTZ(ahora);
  const hoy = parseYMD(hoyYMD);
  const mesActual = hoyYMD.slice(0, 7);
  const mesPrevio = sumarMeses(mesActual, -1);
  const ahoraMs = ahora.getTime();
  const desdeAsistencia = ahoraMs - DIAS_ASISTENCIA * 86_400_000;
  const desdeUso = ahoraMs - DIAS_USO * 86_400_000;

  // ---- pacientes
  const activos = e.pacientes.filter((p) => p.status !== "archived");
  const idsActivos = new Set(activos.map((p) => p.id));
  const conCitaFutura = new Set(
    e.citas
      .filter(
        (c) =>
          new Date(c.starts_at).getTime() > ahoraMs &&
          (c.status === "scheduled" || c.status === "confirmed"),
      )
      .map((c) => c.patient_id),
  );

  // ---- semanas: 12 lunes, el último es el de la semana en curso
  const lunesActual = mondayOfYMD(hoy);
  const semanas = Array.from({ length: SEMANAS }, (_, i) => {
    const lunes = addDaysYMD(lunesActual, -(SEMANAS - 1 - i) * 7);
    return {
      inicioYMD: formatYMD(lunes),
      etiqueta: etiquetaSemana(lunes),
      sesiones: 0,
      enCurso: i === SEMANAS - 1,
    };
  });
  const indiceSemana = new Map(semanas.map((s, i) => [s.inicioYMD, i]));
  const primeraSemanaMs = parseYMD(semanas[0]!.inicioYMD).getTime();

  const sesiones = { esteMes: 0, mesAnterior: 0, horasEsteMes: 0 };
  const asistencia = { acudio: 0, noAcudio: 0, canceloTarde: 0, cancelada: 0, sinMarcar: 0 };
  const porDia = DIAS.map((etiqueta) => ({ etiqueta, sesiones: 0 }));
  const franjas = { manana: 0, tarde: 0 };

  for (const c of e.citas) {
    const inicio = new Date(c.starts_at);
    const ms = inicio.getTime();
    const ymd = ymdInTZ(inicio);
    const mes = ymd.slice(0, 7);

    if (c.attendance === "attended") {
      if (mes === mesActual) {
        sesiones.esteMes++;
        sesiones.horasEsteMes += (new Date(c.ends_at).getTime() - ms) / 3_600_000;
      } else if (mes === mesPrevio) {
        sesiones.mesAnterior++;
      }
    }

    if (ms <= ahoraMs && ms >= desdeAsistencia) {
      if (c.attendance === "attended") asistencia.acudio++;
      else if (c.attendance === "no_show") asistencia.noAcudio++;
      else if (c.attendance === "late_cancel") asistencia.canceloTarde++;
      else if (c.status === "cancelled") asistencia.cancelada++;
      else asistencia.sinMarcar++;
    }

    if (c.status === "cancelled") continue;

    const lunes = formatYMD(mondayOfYMD(parseYMD(ymd)));
    const i = indiceSemana.get(lunes);
    if (i != null) semanas[i]!.sesiones++;

    // Reparto por día y franja: las mismas 12 semanas, solo lo ya pasado.
    if (parseYMD(ymd).getTime() >= primeraSemanaMs && ms <= ahoraMs) {
      const dia = (parseYMD(ymd).getUTCDay() + 6) % 7; // 0 = lunes
      if (dia < DIAS.length) porDia[dia]!.sesiones++;
      if (minutesOfDayInTZ(inicio) < 14 * 60) franjas.manana++;
      else franjas.tarde++;
    }
  }

  const registradas = asistencia.acudio + asistencia.noAcudio + asistencia.canceloTarde;

  // ---- dinero
  const cobrado = new Map(e.cobradoPorMes.map((m) => [m.month, m.paidCents]));
  const esteMes = cobrado.get(mesActual) ?? 0;
  const meses = Array.from({ length: MESES }, (_, i) => {
    const mes = sumarMeses(mesActual, -(MESES - 1 - i));
    return { mes, cents: cobrado.get(mes) ?? 0, enCurso: mes === mesActual };
  });

  // ---- uso de la aplicación, pacientes activos, últimos 30 días
  const recientes = <T,>(filas: T[], fecha: (f: T) => string) =>
    filas.filter((f) => new Date(fecha(f)).getTime() >= desdeUso);
  const tareasRecientes = recientes(e.tareas, (t) => t.created_at).filter((t) =>
    idsActivos.has(t.patient_id),
  );
  const idsTareas = new Set(tareasRecientes.map((t) => t.id));
  const completadas = new Set(
    e.tareasCompletadas.filter((c) => idsTareas.has(c.task_id)).map((c) => c.task_id),
  );

  return {
    pacientes: {
      activos: activos.length,
      archivados: e.pacientes.length - activos.length,
      nuevosEsteMes: activos.filter((p) => mesDe(p.created_at) === mesActual).length,
      conCuenta: activos.filter((p) => p.tieneCuenta).length,
      sinProximaCita: activos.filter((p) => !conCitaFutura.has(p.id)).length,
    },
    sesiones: {
      ...sesiones,
      horasEsteMes: Math.round(sesiones.horasEsteMes * 10) / 10,
    },
    asistencia: {
      ...asistencia,
      tasa: registradas > 0 ? asistencia.acudio / registradas : null,
    },
    dinero: {
      esteMes,
      mesAnterior: cobrado.get(mesPrevio) ?? 0,
      pendiente: e.pendienteCents,
    },
    semanas,
    meses,
    porDia,
    franjas,
    app: {
      activosConCuenta: activos.filter((p) => p.tieneCuenta).length,
      activos: activos.length,
      usanDiario: new Set(
        recientes(e.entradasDiario, (d) => d.created_at)
          .map((d) => d.patient_id)
          .filter((id) => idsActivos.has(id)),
      ).size,
      tareasAsignadas: tareasRecientes.length,
      tareasCompletadas: completadas.size,
      conEscalaActiva: [...e.conEscalaActiva].filter((id) => idsActivos.has(id)).length,
      respuestasEscala: recientes(e.respuestasEscala, (r) => r.submitted_at).filter((r) =>
        idsActivos.has(r.patient_id),
      ).length,
      riesgoSinRevisar: e.riesgoSinRevisar,
    },
  };
}
