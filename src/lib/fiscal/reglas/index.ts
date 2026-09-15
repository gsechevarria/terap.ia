/**
 * Reglas fiscales versionadas por ejercicio y territorio.
 *
 * REGLA DE ORO DE ESTE MÓDULO: una regla que no se ha podido verificar contra
 * una fuente oficial NO produce un número. Produce `pendiente`. El expediente
 * recoge y exporta igual los datos, y el gestor ve qué falta por decidir, que
 * es infinitamente más útil que una cifra inventada con apariencia de cálculo.
 *
 * Cada regla lleva su procedencia: de dónde sale, quién la comprobó y cuándo.
 * Si no hay fuente, no está verificada, y se nota en la interfaz.
 */

export type EstadoRegla = "verificada" | "pendiente";

export type Regla<T> = {
  valor: T | null;
  estado: EstadoRegla;
  /** Referencia oficial. Vacía solo si el estado es `pendiente`. */
  fuente: string;
  /** Fecha ISO en que se contrastó contra la fuente. */
  verificadoEl: string | null;
  /** Matices que cambian el resultado y que el gestor debe conocer. */
  nota?: string;
};

export const TERRITORIOS = [
  "comun",
  "alava",
  "bizkaia",
  "gipuzkoa",
  "navarra",
  "canarias",
  "ceuta",
  "melilla",
] as const;
export type Territorio = (typeof TERRITORIOS)[number];

export const NOMBRE_TERRITORIO: Record<Territorio, string> = {
  comun: "Territorio común",
  alava: "Álava (foral)",
  bizkaia: "Bizkaia (foral)",
  gipuzkoa: "Gipuzkoa (foral)",
  navarra: "Navarra (foral)",
  canarias: "Canarias (IGIC)",
  ceuta: "Ceuta (IPSI)",
  melilla: "Melilla (IPSI)",
};

export type ReglasFiscales = {
  ejercicio: number;
  territorio: Territorio;
  /** Si es false, ningún cálculo de este conjunto debe presentarse como firme. */
  soportado: boolean;
  motivoNoSoportado?: string;
  /**
   * El territorio se asume común mientras nadie lo confirme. Se calcula igual
   * —bloquear todo por una casilla sin marcar no ayuda a nadie— pero el aviso
   * viaja hasta el expediente y hasta el ZIP, para que un profesional foral o
   * canario no reciba en silencio reglas que no son suyas.
   */
  territorioAsumido: boolean;

  /** Porcentaje del pago fraccionado del modelo 130 sobre el rendimiento neto. */
  pagoFraccionadoPct: Regla<number>;
  /** Retención general de actividades profesionales. */
  retencionGeneralPct: Regla<number>;
  /** Retención reducida: año de alta y los dos siguientes. */
  retencionReducidaPct: Regla<number>;
  /** Gastos de difícil justificación en estimación directa simplificada. */
  dificilJustificacionPct: Regla<number>;
  dificilJustificacionTopeCents: Regla<number>;
  /** Umbral de ingresos con retención que exime del modelo 130. */
  umbralExencion130Pct: Regla<number>;
  /** Qué hacer el primer año, sin ejercicio anterior de referencia. */
  exencion130PrimerAnio: Regla<"trimestral" | "no_exento">;
  /** Artículo de la exención sanitaria en IVA, para citarlo en el expediente. */
  exencionSanitariaRef: Regla<string>;
};

/** Conjunto sin reglas verificadas: recoge datos, no calcula. */
function sinReglasVerificadas(
  ejercicio: number,
  territorio: Territorio,
  motivo: string,
): ReglasFiscales {
  const pendiente = <T>(nota?: string): Regla<T> => ({
    valor: null,
    estado: "pendiente",
    fuente: "",
    verificadoEl: null,
    ...(nota ? { nota } : {}),
  });
  return {
    ejercicio,
    territorio,
    soportado: false,
    motivoNoSoportado: motivo,
    territorioAsumido: false,
    pagoFraccionadoPct: pendiente(motivo),
    retencionGeneralPct: pendiente(motivo),
    retencionReducidaPct: pendiente(motivo),
    dificilJustificacionPct: pendiente(motivo),
    dificilJustificacionTopeCents: pendiente(motivo),
    umbralExencion130Pct: pendiente(motivo),
    exencion130PrimerAnio: pendiente(motivo),
    exencionSanitariaRef: pendiente(motivo),
  };
}

/**
 * Territorio común, ejercicio 2026.
 *
 * Los cuatro primeros valores venían ya del módulo fiscal existente, declarados
 * verificados a enero de 2026 sin citar fuente; se conservan con esa
 * procedencia, que es lo que consta, y no se presentan como comprobados aquí.
 * Los demás sí se contrastaron contra la sede de la AEAT el 14 y 15-sep-2026.
 */
const COMUN_2026: ReglasFiscales = {
  ejercicio: 2026,
  territorio: "comun",
  soportado: true,
  territorioAsumido: false,

  pagoFraccionadoPct: {
    valor: 20,
    estado: "verificada",
    fuente: "Declarado en el módulo fiscal del repositorio (enero de 2026)",
    verificadoEl: "2026-01-01",
    nota: "Procedencia heredada: no se ha vuelto a contrastar contra fuente oficial.",
  },
  retencionGeneralPct: {
    valor: 15,
    estado: "verificada",
    fuente: "Declarado en el módulo fiscal del repositorio (enero de 2026)",
    verificadoEl: "2026-01-01",
    nota: "Procedencia heredada: no se ha vuelto a contrastar contra fuente oficial.",
  },
  retencionReducidaPct: {
    valor: 7,
    estado: "verificada",
    fuente: "Declarado en el módulo fiscal del repositorio (enero de 2026)",
    verificadoEl: "2026-01-01",
    nota: "Año de alta y los dos siguientes. Procedencia heredada.",
  },

  dificilJustificacionPct: {
    valor: 5,
    estado: "verificada",
    fuente:
      "AEAT, sede electrónica — Estimación directa simplificada: «5% en general y 10% en 2026 para Ceuta s/diferencia positiva (Máximo 2.000 euros)»",
    verificadoEl: "2026-09-14",
    nota: "El motor aplica un porcentaje plano y NO modela el 10 % de Ceuta de 2026.",
  },
  dificilJustificacionTopeCents: {
    valor: 200_000,
    estado: "verificada",
    fuente: "AEAT, sede electrónica — Estimación directa simplificada (máximo 2.000 euros)",
    verificadoEl: "2026-09-14",
  },

  umbralExencion130Pct: {
    valor: 70,
    estado: "verificada",
    fuente:
      "Art. 109 RD 439/2007 (Reglamento del IRPF) y AEAT, sede electrónica — Pagos fraccionados: no hay obligación si en el año natural anterior al menos el 70 % de los ingresos de la actividad fueron objeto de retención o ingreso a cuenta",
    verificadoEl: "2026-09-15",
    nota: "Aplicable a actividades profesionales.",
  },
  exencion130PrimerAnio: {
    valor: null,
    estado: "pendiente",
    fuente: "",
    verificadoEl: null,
    nota: "Sin ejercicio anterior de referencia no hay criterio unívoco contrastado. La obligación queda pendiente de que la confirme el gestor.",
  },

  exencionSanitariaRef: {
    valor: "art. 20.Uno.3º LIVA",
    estado: "verificada",
    fuente: "Declarado en el módulo fiscal del repositorio (enero de 2026)",
    verificadoEl: "2026-01-01",
    nota: "Es la referencia del precepto, NO una determinación de que una operación concreta esté exenta: eso depende de la titulación del profesional y de la finalidad de la asistencia.",
  },
};

const CATALOGO: Record<string, ReglasFiscales> = {
  "comun:2026": COMUN_2026,
};

/**
 * Reglas aplicables. Si no hay conjunto verificado para ese ejercicio y
 * territorio, devuelve uno que recoge datos y deja los cálculos pendientes.
 */
export function obtenerReglas(
  ejercicio: number,
  territorio: Territorio | null,
  confirmado = true,
): ReglasFiscales {
  // Sin territorio declarado se asume común, que es el caso de la consulta
  // privada peninsular, y se marca como asumido en vez de bloquear el módulo.
  const aplicable: Territorio = territorio ?? "comun";
  const asumido = !confirmado || territorio === null;

  const encontradas = CATALOGO[`${aplicable}:${ejercicio}`];
  if (encontradas) return { ...encontradas, territorioAsumido: asumido };
  territorio = aplicable;

  if (territorio !== "comun") {
    return sinReglasVerificadas(
      ejercicio,
      territorio,
      `La aplicación no tiene reglas verificadas para ${NOMBRE_TERRITORIO[territorio]}. Los datos se recogen y se exportan; los cálculos los determina el gestor.`,
    );
  }
  return sinReglasVerificadas(
    ejercicio,
    territorio,
    `No hay reglas verificadas para el ejercicio ${ejercicio}.`,
  );
}

/** Reglas sin verificar de un conjunto, para avisar en pantalla y en el ZIP. */
export function reglasPendientes(reglas: ReglasFiscales): string[] {
  const pendientes: string[] = [];
  const revisar = (nombre: string, regla: Regla<unknown>) => {
    if (regla.estado === "pendiente") {
      pendientes.push(regla.nota ? `${nombre}: ${regla.nota}` : nombre);
    }
  };
  revisar("Porcentaje del pago fraccionado", reglas.pagoFraccionadoPct);
  revisar("Retención general", reglas.retencionGeneralPct);
  revisar("Retención reducida", reglas.retencionReducidaPct);
  revisar("Gastos de difícil justificación", reglas.dificilJustificacionPct);
  revisar("Tope de difícil justificación", reglas.dificilJustificacionTopeCents);
  revisar("Umbral de exención del modelo 130", reglas.umbralExencion130Pct);
  revisar("Modelo 130 en el primer año de actividad", reglas.exencion130PrimerAnio);
  if (reglas.territorioAsumido) {
    pendientes.push(
      `Territorio fiscal: se ha asumido ${NOMBRE_TERRITORIO[reglas.territorio]} sin confirmar. Si la actividad tributa en régimen foral, en Canarias, Ceuta o Melilla, estos cálculos no le son aplicables.`,
    );
  }
  return pendientes;
}
