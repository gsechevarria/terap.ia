import { allRows, checked } from "@/lib/query-result";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfessional } from "@/lib/queries/identity";
import { getProfessionalAgendaRange, type AgendaAppointment, type AgendaBlock } from "@/lib/queries/appointments";
import type { ScaleDefinition } from "@/lib/scales";
import {
  addDaysYMD,
  formatYMD,
  fromWallClock,
  minutesOfDayInTZ,
  mondayOfYMD,
  parseYMD,
  ymdInTZ,
  ymdParts,
} from "@/lib/tz";

/**
 * Datos de la pantalla «Hoy».
 *
 * TODO lo que sale aquí procede de tablas que existen. Lo que la maqueta pide y
 * el esquema no tiene se declara ausente y la vista lo dice en voz alta; no se
 * rellena con supuestos. Concretamente NO EXISTEN hoy en la base de datos:
 *
 *  · el horario de consulta o la disponibilidad semanal del profesional. Por
 *    eso la jornada se dibuja entre la primera y la última hora ocupadas del
 *    día —que es un hecho— y no «de 9 a 17» —que sería un invento—, y por eso
 *    no hay denominador: se dice «4 h 10 min de sesión», nunca «de 8 h
 *    disponibles»;
 *  · la lista de espera;
 *  · la frecuencia acordada con cada paciente;
 *  · la sala o despacho;
 *  · el estado «enlace de videollamada enviado».
 *
 * Y dos matices que cambian lo que se puede AFIRMAR, no solo lo que se puede
 * pintar:
 *
 *  · `attendance = 'late_cancel'` es una etiqueta que el profesional elige a
 *    mano en el modal de asistencia. NO hay ninguna regla que compare la hora
 *    de cancelación con la de la cita, así que la cifra es «cancelaciones que
 *    marcaste como tardías», no «canceladas con menos de 24 h». El rótulo lo
 *    dice así.
 *  · `payment_settings` sí existe, con la cascada precio del paciente → precio
 *    por defecto. Se replica aquí la MISMA cascada que hace
 *    `settle_attended_appointment` en SQL, incluido el detalle de que no filtra
 *    por `session_type`.
 */

/** Minutos por hora de rejilla en la agenda del día. */
export const ALTO_HORA = 42;

export type TramoJornada = {
  /** Minuto de inicio dentro del día, hora de Madrid. */
  desde: number;
  hasta: number;
  clase: "realizada" | "proxima" | "confirmada" | "sin-confirmar" | "libre" | "bloqueado";
};

export type SesionDelDia = {
  id: string;
  patientId: string;
  paciente: string;
  desde: number;
  hasta: number;
  inicioISO: string;
  finISO: string;
  /** Presencial salvo que la cita traiga enlace de videollamada. */
  online: boolean;
  videoLink: string | null;
  clase: "realizada" | "proxima" | "confirmada" | "sin-confirmar" | "cancelada" | "no-acudio";
  /** El paciente tiene alguna respuesta con ítem de riesgo sin revisar. */
  avisoPendiente: boolean;
};

export type FranjaBloqueada = {
  id: string;
  desde: number;
  hasta: number;
  motivo: string | null;
};

export type HuecoLibre = {
  desde: number;
  hasta: number;
  /** Nace de una cita cancelada, y entonces se dice de quién era. */
  liberadoPor: string | null;
};

export type PuntoEscala = { score: number; fecha: string };

export type ProximaSesion = {
  id: string;
  patientId: string;
  paciente: string;
  inicioISO: string;
  finISO: string;
  /**
   * Días de calendario que faltan, en hora de Madrid: 0 hoy, 1 mañana, 6 el
   * mismo día de la semana que viene. Es distancia entre DÍAS, no entre
   * instantes: una cita a las 09:00 de mañana está «a 1 día» aunque falten
   * catorce horas, que es como lo diría cualquiera.
   */
  diasHasta: number;
  online: boolean;
  videoLink: string | null;
  /** Número de sesión: citas ya atendidas + esta. */
  numeroSesion: number;
  escala: { codigo: string; nombre: string; puntos: PuntoEscala[] } | null;
  tareas: { hechas: number; total: number } | null;
  /** Días distintos con registro de diario en los últimos 7. */
  diarioDias: number | null;
};

export type AvisoSeguridad = {
  responseId: string;
  assignmentId: string;
  patientId: string;
  paciente: string;
  escala: string;
  submittedAt: string;
  /** Texto literal del ítem de riesgo y de la opción que marcó el paciente. */
  pregunta: string | null;
  respuesta: string | null;
  /** Hora de su cita de hoy, si la tiene. */
  citaHoy: string | null;
};

export type DiaDeLaSemana = {
  ymd: string;
  etiqueta: string;
  diaDelMes: string;
  /** Horas reservadas ese día. */
  horas: number;
  esHoy: boolean;
};

export type SemanaEnCurso = {
  dias: DiaDeLaSemana[];
  horasTotales: number;
};

export type PacienteSinCita = {
  id: string;
  nombre: string;
  /** Última sesión atendida. `null` si nunca ha acudido a ninguna. */
  ultimaSesionISO: string | null;
  diasDesde: number | null;
};

export type SemanaOcupacion = {
  inicioYMD: string;
  etiqueta: string;
  horas: number;
  esSemanaEnCurso: boolean;
};

export type CifrasOperativas = {
  cancelacionesTardias: { esteMes: number; mesAnterior: number; citasDelMes: number };
  inasistencias: { esteMes: number };
  ingresosPrevistos: { cents: number; sesiones: number; sinTarifa: number } | null;
  franjaConMasCancelaciones: { etiqueta: string; casos: number; total: number } | null;
};

export type PanelDeHoy = {
  ahoraISO: string;
  /** Minuto del día en Madrid, para la línea de «ahora». */
  ahoraMinuto: number;
  hoyYMD: string;
  sesiones: SesionDelDia[];
  bloqueos: FranjaBloqueada[];
  huecos: HuecoLibre[];
  /** Ventana dibujada de la agenda, en minutos del día. */
  ventana: { desde: number; hasta: number };
  tramos: TramoJornada[];
  minutosDeSesion: number;
  proxima: ProximaSesion | null;
  avisos: AvisoSeguridad[];
  semana: SemanaEnCurso;
  sinProximaCita: PacienteSinCita[];
  ocupacion: SemanaOcupacion[];
  cifras: CifrasOperativas;
};

const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;
const DIAS_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
const MINUTOS_DIA = 24 * 60;
/** Ventanas ofrecidas por el segmentado de la gráfica de ocupación. */
export const VENTANAS_OCUPACION = { "12s": 12, "6m": 26 } as const;
export type VentanaOcupacion = keyof typeof VENTANAS_OCUPACION;

export function ventanaValida(raw: string | undefined): VentanaOcupacion {
  return raw === "6m" ? "6m" : "12s";
}
/** Ventana sobre la que se busca la franja con más cancelaciones. */
const DIAS_FRANJA_CANCELACIONES = 180;

function isoDeYMD(ymd: string, hh = 0, mm = 0): string {
  const [y, m, d] = ymdParts(ymd);
  return fromWallClock(y, m, d, hh, mm).toISOString();
}

/** Minuto del día, en Madrid, acotado a [0, 1440]. Una cita que cruza la
 *  medianoche se recorta al día que se está pintando en vez de desaparecer. */
function minutoEnDia(iso: string, diaYMD: string): number {
  const d = new Date(iso);
  const ymd = ymdInTZ(d);
  if (ymd < diaYMD) return 0;
  if (ymd > diaYMD) return MINUTOS_DIA;
  return minutesOfDayInTZ(d);
}

function horasEntre(inicioISO: string, finISO: string): number {
  return Math.max(0, (new Date(finISO).getTime() - new Date(inicioISO).getTime()) / 3_600_000);
}

function diasEntre(desdeISO: string, hastaISO: string): number {
  const a = parseYMD(ymdInTZ(new Date(desdeISO))).getTime();
  const b = parseYMD(ymdInTZ(new Date(hastaISO))).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Etiqueta corta del inicio de semana: «7 jul» el primero de cada mes, si no el día. */
function etiquetaSemana(ymd: string, anterior: string | null): string {
  const [, m, d] = ymdParts(ymd);
  const mes = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"][m - 1] ?? "";
  const mesAnterior = anterior ? ymdParts(anterior)[1] : null;
  return mesAnterior === m ? String(d) : `${d} ${mes}`;
}

/**
 * Panel completo de «Hoy» en un solo viaje coordinado.
 *
 * `ahora` se recibe y no se toma de `new Date()` dentro del render: la pantalla
 * es de servidor y el instante tiene que ser el mismo para todos los bloques,
 * o la línea de «ahora» y la próxima sesión pueden discrepar entre sí.
 */
export async function getPanelDeHoy(
  ahora: Date,
  ventana: VentanaOcupacion = "12s",
): Promise<PanelDeHoy> {
  const semanasOcupacion = VENTANAS_OCUPACION[ventana];
  const pro = await getCurrentProfessional();
  const hoyYMD = ymdInTZ(ahora);
  const mananaYMD = formatYMD(addDaysYMD(parseYMD(hoyYMD), 1));

  const vacio: PanelDeHoy = {
    ahoraISO: ahora.toISOString(),
    ahoraMinuto: minutesOfDayInTZ(ahora),
    hoyYMD,
    sesiones: [],
    bloqueos: [],
    huecos: [],
    ventana: { desde: 9 * 60, hasta: 21 * 60 },
    tramos: [],
    minutosDeSesion: 0,
    proxima: null,
    avisos: [],
    semana: { dias: [], horasTotales: 0 },
    sinProximaCita: [],
    ocupacion: [],
    cifras: {
      cancelacionesTardias: { esteMes: 0, mesAnterior: 0, citasDelMes: 0 },
      inasistencias: { esteMes: 0 },
      ingresosPrevistos: null,
      franjaConMasCancelaciones: null,
    },
  };
  if (!pro) return vacio;

  const supabase = await createClient();

  // Ventanas de tiempo. Todas se anclan a la medianoche DE MADRID.
  const lunesEstaSemana = formatYMD(mondayOfYMD(parseYMD(hoyYMD)));
  const primerLunes = formatYMD(addDaysYMD(parseYMD(lunesEstaSemana), -7 * (semanasOcupacion - 1)));
  const [ay, am] = ymdParts(hoyYMD);
  const inicioMesYMD = `${String(ay).padStart(4, "0")}-${String(am).padStart(2, "0")}-01`;
  const inicioMesAnteriorYMD = am === 1
    ? `${String(ay - 1).padStart(4, "0")}-12-01`
    : `${String(ay).padStart(4, "0")}-${String(am - 1).padStart(2, "0")}-01`;
  const desdeFranjas = formatYMD(addDaysYMD(parseYMD(hoyYMD), -DIAS_FRANJA_CANCELACIONES));

  const [
    hoy,
    proximaRes,
    rangoLargo,
    pacientesRes,
    futurasRes,
    atendidasRes,
    flaggedRes,
    tarifasRes,
  ] = await Promise.all([
    getProfessionalAgendaRange(isoDeYMD(hoyYMD), isoDeYMD(mananaYMD)),
    // La siguiente cita viva, SIN techo: puede ser dentro de un rato o dentro
    // de tres semanas, y en los dos casos es la que toca enseñar. Antes se
    // miraba solo hasta mañana y a partir de ahí la tarjeta decía que no
    // quedaba ninguna sesión, que era falso.
    checked(
      supabase
        .from("appointments")
        .select(
          "id, professional_id, patient_id, starts_at, ends_at, status, attendance, video_link, recurrence_freq, recurrence_until, parent_appointment_id, notes, created_at, updated_at, patients(full_name)",
        )
        .gt("starts_at", ahora.toISOString())
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ),
    // Una sola lectura cubre la ocupación de 12 semanas, las cifras del mes y
    // la franja con más cancelaciones: son ventanas distintas del mismo dato.
    allRows(
      supabase
        .from("appointments")
        .select("id, patient_id, starts_at, ends_at, status, attendance")
        .gte("starts_at", isoDeYMD(desdeFranjas < primerLunes ? desdeFranjas : primerLunes))
        .lt("starts_at", isoDeYMD(formatYMD(addDaysYMD(parseYMD(lunesEstaSemana), 7)))),
    ),
    allRows(
      supabase
        .from("patients")
        .select("id, full_name")
        .eq("status", "active"),
    ),
    // Citas futuras vivas: quien aparezca aquí NO está «sin próxima cita».
    allRows(
      supabase
        .from("appointments")
        .select("id, patient_id")
        .gte("starts_at", ahora.toISOString())
        .neq("status", "cancelled"),
    ),
    // Última sesión realmente atendida, por paciente.
    //
    // Trae TODO el histórico atendido y se queda con el máximo por paciente en
    // JS. Es deliberado y tiene un techo conocido: `allRows` pagina de 500 en
    // 500, así que una consulta con diez años de historia son ~10 viajes. No se
    // acota por fecha porque la pregunta es «¿cuándo vino por última vez?» y a
    // quien lleva dos años sin aparecer es justo a quien hay que enseñar. Si
    // algún día pesa, el sitio correcto es una RPC con `distinct on
    // (patient_id)`, no recortar la ventana aquí.
    allRows(
      supabase
        .from("appointments")
        .select("id, patient_id, starts_at")
        .eq("attendance", "attended")
        .lte("starts_at", ahora.toISOString()),
    ),
    // Avisos de ítem de riesgo abiertos, de TODOS los pacientes del profesional.
    // La RLS ya acota a los suyos; el `!inner` garantiza el nombre.
    allRows(
      supabase
        .from("scale_responses")
        .select("id, assignment_id, patient_id, submitted_at, answers, patients!inner(full_name), scales!inner(code, name, definition)")
        .eq("flagged", true)
        .is("acknowledged_at", null),
    ),
    allRows(
      supabase
        .from("payment_settings")
        .select("id, patient_id, price_cents")
        .eq("professional_id", pro.id),
    ),
  ]);

  // ---- Avisos de seguridad ------------------------------------------------
  type FilaFlagged = {
    id: string;
    assignment_id: string;
    patient_id: string;
    submitted_at: string;
    answers: unknown;
    patients: { full_name: string | null } | null;
    scales: { code: string; name: string; definition: unknown } | null;
  };
  const avisos: AvisoSeguridad[] = (flaggedRes.data as FilaFlagged[])
    .map((r) => {
      const def = (r.scales?.definition ?? null) as ScaleDefinition | null;
      const item = def?.flag_item ?? null;
      const respuestas = (r.answers ?? {}) as Record<string, number>;
      const valor = item != null ? respuestas[String(item)] : undefined;
      return {
        responseId: r.id,
        assignmentId: r.assignment_id,
        patientId: r.patient_id,
        paciente: r.patients?.full_name ?? "Sin nombre",
        escala: r.scales?.code ?? "",
        submittedAt: r.submitted_at,
        pregunta: def?.items.find((i) => i.id === item)?.text ?? null,
        respuesta:
          valor == null ? null : (def?.options.find((o) => o.value === valor)?.label ?? null),
        citaHoy: null as string | null,
      };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const conAvisoAbierto = new Set(avisos.map((a) => a.patientId));

  // ---- Agenda del día -----------------------------------------------------
  const vivas = hoy.appointments.filter((a) => a.status !== "cancelled");
  const canceladas = hoy.appointments.filter((a) => a.status === "cancelled");

  const primeraFutura = vivas.find((a) => new Date(a.starts_at).getTime() > ahora.getTime());

  const sesiones: SesionDelDia[] = vivas.map((a) => ({
    id: a.id,
    patientId: a.patient_id,
    paciente: a.patientName ?? "Sin nombre",
    desde: minutoEnDia(a.starts_at, hoyYMD),
    hasta: minutoEnDia(a.ends_at, hoyYMD),
    inicioISO: a.starts_at,
    finISO: a.ends_at,
    online: Boolean(a.video_link),
    videoLink: a.video_link,
    clase: claseDeSesion(a, ahora, primeraFutura?.id ?? null),
    avisoPendiente: conAvisoAbierto.has(a.patient_id),
  }));

  for (const aviso of avisos) {
    const cita = sesiones.find((s) => s.patientId === aviso.patientId);
    if (cita) aviso.citaHoy = cita.inicioISO;
  }

  const bloqueos: FranjaBloqueada[] = hoy.blocks.map((b: AgendaBlock) => ({
    id: b.id,
    desde: minutoEnDia(b.starts_at, hoyYMD),
    hasta: minutoEnDia(b.ends_at, hoyYMD),
    motivo: b.reason,
  }));

  // Ventana dibujada. Sin horario de consulta en la base de datos, la única
  // afirmación honesta es «esto es lo que hay ocupado hoy», redondeado a horas
  // completas y con un mínimo de seis para que la rejilla no quede raquítica.
  const ocupados = [
    ...sesiones.map((s) => [s.desde, s.hasta] as const),
    ...bloqueos.map((b) => [b.desde, b.hasta] as const),
    ...canceladas.map((a) => [minutoEnDia(a.starts_at, hoyYMD), minutoEnDia(a.ends_at, hoyYMD)] as const),
  ];
  let desdeVentana = 9 * 60;
  let hastaVentana = 21 * 60;
  if (ocupados.length > 0) {
    const min = Math.min(...ocupados.map(([d]) => d));
    const max = Math.max(...ocupados.map(([, h]) => h));
    desdeVentana = Math.max(0, Math.floor(min / 60) * 60 - 60);
    hastaVentana = Math.min(MINUTOS_DIA, Math.ceil(max / 60) * 60 + 60);
    if (hastaVentana - desdeVentana < 6 * 60) hastaVentana = Math.min(MINUTOS_DIA, desdeVentana + 6 * 60);
  }

  // Huecos: lo que queda libre entre lo ocupado, dentro de la ventana. Una cita
  // cancelada deja su hueco y dice de quién era; el resto son huecos a secas.
  const huecos = calcularHuecos(
    [...sesiones.map((s) => [s.desde, s.hasta] as const), ...bloqueos.map((b) => [b.desde, b.hasta] as const)],
    desdeVentana,
    hastaVentana,
    canceladas.map((a) => ({
      desde: minutoEnDia(a.starts_at, hoyYMD),
      hasta: minutoEnDia(a.ends_at, hoyYMD),
      paciente: a.patientName ?? null,
    })),
  );

  const tramos = construirTramos(sesiones, bloqueos, desdeVentana, hastaVentana);
  const minutosDeSesion = sesiones.reduce((t, s) => t + Math.max(0, s.hasta - s.desde), 0);

  // ---- Próxima sesión -----------------------------------------------------
  // `primeraFutura` sale de la agenda de hoy y es la que la rejilla pinta como
  // «próxima»; `proximaRes` es la siguiente del calendario entero. Coinciden
  // siempre que quede algo hoy, y cuando no, la segunda es la buena.
  const fila = proximaRes.data as
    | (Omit<AgendaAppointment, "patientName"> & { patients: { full_name: string | null } | null })
    | null;
  const candidata: AgendaAppointment | null = primeraFutura
    ? primeraFutura
    : fila
      ? { ...(fila as unknown as AgendaAppointment), patientName: fila.patients?.full_name ?? null }
      : null;
  const proxima = candidata ? await detalleProximaSesion(candidata, ahora) : null;

  // ---- Semana en curso ----------------------------------------------------
  const largo = rangoLargo.data as {
    id: string;
    patient_id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    attendance: string;
  }[];
  const vivasLargo = largo.filter((a) => a.status !== "cancelled");

  const dias: DiaDeLaSemana[] = Array.from({ length: 6 }, (_, i) => {
    const ymd = formatYMD(addDaysYMD(parseYMD(lunesEstaSemana), i));
    const horas = vivasLargo
      .filter((a) => ymdInTZ(new Date(a.starts_at)) === ymd)
      .reduce((t, a) => t + horasEntre(a.starts_at, a.ends_at), 0);
    return {
      ymd,
      etiqueta: DIAS[i] ?? "",
      diaDelMes: String(ymdParts(ymd)[2]),
      horas: Math.round(horas * 10) / 10,
      esHoy: ymd === hoyYMD,
    };
  });
  const semana: SemanaEnCurso = {
    dias,
    horasTotales: Math.round(dias.reduce((t, d) => t + d.horas, 0) * 10) / 10,
  };

  // ---- Ocupación de las últimas 12 semanas --------------------------------
  const porSemana = new Map<string, number>();
  for (let i = 0; i < semanasOcupacion; i++) {
    porSemana.set(formatYMD(addDaysYMD(parseYMD(primerLunes), i * 7)), 0);
  }
  for (const a of vivasLargo) {
    const lunes = formatYMD(mondayOfYMD(parseYMD(ymdInTZ(new Date(a.starts_at)))));
    if (porSemana.has(lunes)) {
      porSemana.set(lunes, (porSemana.get(lunes) ?? 0) + horasEntre(a.starts_at, a.ends_at));
    }
  }
  const ocupacion: SemanaOcupacion[] = [...porSemana.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([inicioYMD, horas], i, todas) => ({
      inicioYMD,
      etiqueta: etiquetaSemana(inicioYMD, i > 0 ? (todas[i - 1]?.[0] ?? null) : null),
      horas: Math.round(horas * 10) / 10,
      esSemanaEnCurso: inicioYMD === lunesEstaSemana,
    }));

  // ---- Pacientes sin próxima cita -----------------------------------------
  const conFutura = new Set((futurasRes.data as { patient_id: string }[]).map((a) => a.patient_id));
  const ultimaPorPaciente = new Map<string, string>();
  for (const a of atendidasRes.data as { patient_id: string; starts_at: string }[]) {
    const previa = ultimaPorPaciente.get(a.patient_id);
    if (!previa || a.starts_at > previa) ultimaPorPaciente.set(a.patient_id, a.starts_at);
  }
  const sinProximaCita: PacienteSinCita[] = (pacientesRes.data as { id: string; full_name: string | null }[])
    .filter((p) => !conFutura.has(p.id))
    .map((p) => {
      const ultima = ultimaPorPaciente.get(p.id) ?? null;
      return {
        id: p.id,
        nombre: p.full_name ?? "Sin nombre",
        ultimaSesionISO: ultima,
        diasDesde: ultima ? diasEntre(ultima, ahora.toISOString()) : null,
      };
    })
    // Primero quien lleva más tiempo sin sesión; quien nunca ha venido, al final.
    .sort((a, b) => (b.diasDesde ?? -1) - (a.diasDesde ?? -1));

  // ---- Cifras operativas --------------------------------------------------
  const delMes = largo.filter((a) => ymdInTZ(new Date(a.starts_at)) >= inicioMesYMD);
  const delMesAnterior = largo.filter((a) => {
    const ymd = ymdInTZ(new Date(a.starts_at));
    return ymd >= inicioMesAnteriorYMD && ymd < inicioMesYMD;
  });

  const tarifas = tarifasRes.data as { patient_id: string | null; price_cents: number }[];
  const tarifaPorPaciente = new Map<string, number>();
  let tarifaPorDefecto: number | null = null;
  for (const t of tarifas) {
    if (t.patient_id) tarifaPorPaciente.set(t.patient_id, t.price_cents);
    else if (tarifaPorDefecto == null) tarifaPorDefecto = t.price_cents;
  }
  const finSemanaISO = isoDeYMD(formatYMD(addDaysYMD(parseYMD(lunesEstaSemana), 7)));
  const deEstaSemana = vivasLargo.filter(
    (a) => a.starts_at >= isoDeYMD(lunesEstaSemana) && a.starts_at < finSemanaISO,
  );
  let cents = 0;
  let sinTarifa = 0;
  for (const a of deEstaSemana) {
    const precio = tarifaPorPaciente.get(a.patient_id) ?? tarifaPorDefecto;
    if (precio == null) sinTarifa += 1;
    else cents += precio;
  }

  const franja = franjaConMasCancelaciones(largo, desdeFranjas);

  return {
    ahoraISO: ahora.toISOString(),
    ahoraMinuto: minutesOfDayInTZ(ahora),
    hoyYMD,
    sesiones,
    bloqueos,
    huecos,
    ventana: { desde: desdeVentana, hasta: hastaVentana },
    tramos,
    minutosDeSesion,
    proxima,
    avisos,
    semana,
    sinProximaCita,
    ocupacion,
    cifras: {
      cancelacionesTardias: {
        esteMes: delMes.filter((a) => a.attendance === "late_cancel").length,
        mesAnterior: delMesAnterior.filter((a) => a.attendance === "late_cancel").length,
        citasDelMes: delMes.length,
      },
      inasistencias: { esteMes: delMes.filter((a) => a.attendance === "no_show").length },
      ingresosPrevistos:
        tarifas.length === 0
          ? null
          : { cents, sesiones: deEstaSemana.length, sinTarifa },
      franjaConMasCancelaciones: franja,
    },
  };
}

function claseDeSesion(
  a: AgendaAppointment,
  ahora: Date,
  idProxima: string | null,
): SesionDelDia["clase"] {
  if (a.attendance === "attended" || a.status === "completed") return "realizada";
  if (a.attendance === "no_show") return "no-acudio";
  if (a.attendance === "late_cancel") return "cancelada";
  if (new Date(a.ends_at).getTime() <= ahora.getTime()) return "realizada";
  if (a.id === idProxima) return "proxima";
  return a.status === "confirmed" ? "confirmada" : "sin-confirmar";
}

/** Huecos libres entre lo ocupado, dentro de la ventana dibujada. */
function calcularHuecos(
  ocupado: readonly (readonly [number, number])[],
  desde: number,
  hasta: number,
  cancelados: { desde: number; hasta: number; paciente: string | null }[],
): HuecoLibre[] {
  const ordenado = [...ocupado].filter(([d, h]) => h > d).sort((a, b) => a[0] - b[0]);
  const huecos: HuecoLibre[] = [];
  let cursor = desde;
  for (const [d, h] of ordenado) {
    if (d > cursor) huecos.push({ desde: cursor, hasta: Math.min(d, hasta), liberadoPor: null });
    cursor = Math.max(cursor, h);
  }
  if (cursor < hasta) huecos.push({ desde: cursor, hasta, liberadoPor: null });

  // Un hueco que contiene una cita cancelada lleva su nombre: no es lo mismo
  // «tienes libre de 11 a 12» que «Óscar canceló, tienes libre de 11 a 12».
  return huecos
    .filter((g) => g.hasta - g.desde >= 15)
    .map((g) => {
      const cancelada = cancelados.find((c) => c.desde >= g.desde && c.hasta <= g.hasta);
      return cancelada ? { ...g, liberadoPor: cancelada.paciente } : g;
    });
}

/** Segmentos proporcionales de la barra de jornada, de extremo a extremo. */
function construirTramos(
  sesiones: SesionDelDia[],
  bloqueos: FranjaBloqueada[],
  desde: number,
  hasta: number,
): TramoJornada[] {
  const piezas: TramoJornada[] = [
    ...sesiones
      .filter((s) => s.clase !== "cancelada" && s.clase !== "no-acudio")
      .map((s) => ({
        desde: Math.max(s.desde, desde),
        hasta: Math.min(s.hasta, hasta),
        clase:
          s.clase === "realizada"
            ? ("realizada" as const)
            : s.clase === "proxima"
              ? ("proxima" as const)
              : s.clase === "confirmada"
                ? ("confirmada" as const)
                : ("sin-confirmar" as const),
      })),
    ...bloqueos.map((b) => ({
      desde: Math.max(b.desde, desde),
      hasta: Math.min(b.hasta, hasta),
      clase: "bloqueado" as const,
    })),
  ]
    .filter((p) => p.hasta > p.desde)
    .sort((a, b) => a.desde - b.desde);

  const tramos: TramoJornada[] = [];
  let cursor = desde;
  for (const p of piezas) {
    if (p.desde > cursor) tramos.push({ desde: cursor, hasta: p.desde, clase: "libre" });
    if (p.hasta > cursor) {
      tramos.push({ desde: Math.max(p.desde, cursor), hasta: p.hasta, clase: p.clase });
      cursor = p.hasta;
    }
  }
  if (cursor < hasta) tramos.push({ desde: cursor, hasta, clase: "libre" });
  return tramos;
}

/**
 * Franja horaria que más cancelaciones acumula.
 *
 * Cuenta canceladas, no-shows y cancelaciones tardías agrupadas por día de la
 * semana y hora de inicio, en hora de Madrid. Devuelve `null` si no hay ninguna:
 * decir «ninguna franja destaca» pide al menos una cancelación que mirar.
 */
function franjaConMasCancelaciones(
  citas: { starts_at: string; status: string; attendance: string }[],
  desdeYMD: string,
): CifrasOperativas["franjaConMasCancelaciones"] {
  const fallidas = citas.filter(
    (a) =>
      ymdInTZ(new Date(a.starts_at)) >= desdeYMD &&
      (a.status === "cancelled" || a.attendance === "no_show" || a.attendance === "late_cancel"),
  );
  if (fallidas.length === 0) return null;

  const cuenta = new Map<string, number>();
  for (const a of fallidas) {
    const d = new Date(a.starts_at);
    // `getUTCDay` sobre la fecha de calendario de Madrid: `parseYMD` ancla a
    // UTC a propósito, así que el día de la semana sale correcto.
    const dia = (parseYMD(ymdInTZ(d)).getUTCDay() + 6) % 7;
    const hora = Math.floor(minutesOfDayInTZ(d) / 60);
    const clave = `${dia}|${hora}`;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  const [clave, casos] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["0|0", 0];
  const [dia, hora] = clave.split("|").map(Number) as [number, number];
  const nombre = DIAS_LARGO[dia] ?? "";
  return {
    etiqueta: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}, ${hora} h`,
    casos,
    total: fallidas.length,
  };
}

/**
 * Detalle del paciente de la próxima sesión.
 *
 * Son cuatro lecturas y van en paralelo porque ninguna depende de otra. Se hace
 * solo para UN paciente: es la tarjeta de la siguiente sesión, no un listado.
 */
async function detalleProximaSesion(
  cita: AgendaAppointment,
  ahora: Date,
): Promise<ProximaSesion> {
  const supabase = await createClient();
  const desdeDiario = formatYMD(addDaysYMD(parseYMD(ymdInTZ(ahora)), -6));

  const [atendidasRes, escalaRes, tareasRes, completadasRes, diarioRes] = await Promise.all([
    checked(
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", cita.patient_id)
        .eq("attendance", "attended")
        .lte("starts_at", ahora.toISOString()),
    ),
    // Últimas 8 tomas del paciente. Se pide por paciente y no por asignación:
    // la tarjeta enseña «su escala principal», y la principal es de la que hay
    // respuestas más recientes.
    checked(
      supabase
        .from("scale_responses")
        .select("score, submitted_at, assignment_id, scales!inner(code, name)")
        .eq("patient_id", cita.patient_id)
        .not("score", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(8),
    ),
    allRows(supabase.from("tasks").select("id").eq("patient_id", cita.patient_id)),
    allRows(supabase.from("task_completions").select("id, task_id").eq("patient_id", cita.patient_id)),
    allRows(
      supabase
        .from("mood_entries")
        .select("id, entry_date")
        .eq("patient_id", cita.patient_id)
        .gte("entry_date", desdeDiario),
    ),
  ]);

  type FilaEscala = {
    score: number | null;
    submitted_at: string;
    assignment_id: string;
    scales: { code: string; name: string } | null;
  };
  const filas = (escalaRes.data ?? []) as FilaEscala[];
  // Todas las tomas del gráfico deben ser de la MISMA escala: mezclar un PHQ-9
  // con un GAD-7 en una sola línea dibujaría una tendencia que no existe.
  const codigo = filas[0]?.scales?.code ?? null;
  const mismaEscala = codigo ? filas.filter((f) => f.scales?.code === codigo) : [];
  const puntos: PuntoEscala[] = mismaEscala
    .filter((f): f is FilaEscala & { score: number } => f.score != null)
    .map((f) => ({ score: f.score, fecha: f.submitted_at }))
    .reverse();

  const tareas = (tareasRes.data as { id: string }[]).length;
  const hechas = new Set(
    (completadasRes.data as { task_id: string }[]).map((c) => c.task_id),
  ).size;
  const diasConDiario = new Set(
    (diarioRes.data as { entry_date: string }[]).map((m) => m.entry_date),
  ).size;

  return {
    id: cita.id,
    patientId: cita.patient_id,
    paciente: cita.patientName ?? "Sin nombre",
    inicioISO: cita.starts_at,
    finISO: cita.ends_at,
    diasHasta: diasEntre(ahora.toISOString(), cita.starts_at),
    online: Boolean(cita.video_link),
    videoLink: cita.video_link,
    numeroSesion: (atendidasRes.count ?? 0) + 1,
    escala:
      puntos.length > 0 && codigo
        ? { codigo, nombre: mismaEscala[0]?.scales?.name ?? codigo, puntos }
        : null,
    tareas: tareas > 0 ? { hechas, total: tareas } : null,
    diarioDias: diasConDiario > 0 ? diasConDiario : null,
  };
}
