/**
 * Colocación de las citas de un día en carriles para resolver los solapes.
 *
 * Vivía dentro de `AgendaCalendar.tsx`, que necesita DOM para poder importarse:
 * es el algoritmo más propenso a errores de todo el repo y no tenía ni un solo
 * test. Aquí es una función pura con sus casos cubiertos en
 * `appointment-layout.test.ts`.
 */

export type LayoutInput = {
  id: string;
  /** Minutos desde medianoche (hora de Madrid) del inicio y del fin. */
  startMin: number;
  endMin: number;
};

export type LayoutBox = {
  id: string;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
};

export type LayoutOptions = {
  hourStart: number;
  hourEnd: number;
  hourPx: number;
  /** Alto mínimo en px para que una cita corta siga siendo pinchable. */
  minHeightPx?: number;
  /** Duración mínima visual en minutos. */
  minMinutes?: number;
};

export function layoutDay(
  appts: LayoutInput[],
  opts: LayoutOptions,
): LayoutBox[] {
  const { hourStart, hourEnd, hourPx } = opts;
  const minHeightPx = opts.minHeightPx ?? 18;
  const minMinutes = opts.minMinutes ?? 25;

  const desde = hourStart * 60;
  const hasta = hourEnd * 60;

  const evs = appts
    // Se descarta lo que NO interseca la ventana ANTES de recortar. Al revés
    // —como estaba— una cita de 02:00 a 05:00 quedaba con s = 07:00 y
    // e = s + 25 min, y se pintaba como un bloque real a primera hora de la
    // mañana: una cita inexistente en la agenda del profesional.
    .filter((a) => a.endMin > desde && a.startMin < hasta)
    .map((a) => {
      // Recorte a la ventana visible: lo que empieza antes de las 07:00 o
      // termina después de las 21:00 se pinta hasta el borde, no fuera.
      const s = Math.max(a.startMin, desde);
      const e = Math.min(Math.max(a.endMin, s + minMinutes), hasta);
      return { a, s, e };
    })
    .filter((ev) => ev.e > ev.s)
    .sort((x, y) => x.s - y.s || x.e - y.e);

  // Un carril por cadena de solapes: se reutiliza el primero cuyo último
  // evento ya haya terminado.
  const laneEnds: number[] = [];
  const withLane = evs.map((ev) => {
    let lane = laneEnds.findIndex((end) => end <= ev.s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = ev.e;
    return { ...ev, lane };
  });
  const lanes = Math.max(1, laneEnds.length);

  return withLane.map(({ a, s, e, lane }) => ({
    id: a.id,
    top: ((s - hourStart * 60) / 60) * hourPx,
    height: Math.max(((e - s) / 60) * hourPx - 2, minHeightPx),
    leftPct: (lane / lanes) * 100,
    widthPct: 100 / lanes,
  }));
}
