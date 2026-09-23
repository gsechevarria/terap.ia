import Link from "next/link";
import type { ProximaSesion, PuntoEscala } from "@/lib/queries/hoy";
import { formatCuantoFalta, formatTime, nombreDelDia } from "@/lib/format";

/**
 * Gráfica de las últimas tomas, en blanco sobre el verde de la tarjeta.
 *
 * Es deliberadamente NEUTRA: una sola línea del mismo color suba o baje. Pintar
 * de verde la mejoría y de rojo el empeoramiento sería interpretar un resultado
 * clínico, que es exactamente lo que esta aplicación no hace. El último punto
 * se marca más grande porque es el más reciente, no porque sea mejor ni peor.
 */
function Tendencia({ puntos, escala }: { puntos: PuntoEscala[]; escala: string }) {
  const W = 280;
  const H = 54;
  const valores = puntos.map((p) => p.score);
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const rango = Math.max(1, max - min);
  const paso = puntos.length > 1 ? (W - 12) / (puntos.length - 1) : 0;

  const coords = puntos.map((p, i) => {
    const x = 6 + i * paso;
    // Escala invertida: la puntuación alta queda arriba del trazo. No hay
    // juicio en ello — es el orden natural de un eje de valores.
    const y = H - 8 - ((p.score - min) / rango) * (H - 16);
    return [x, y] as const;
  });

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${escala}, últimas ${puntos.length} puntuaciones: ${valores.join(", ")}`}
    >
      <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      {coords.length > 1 && (
        <polyline
          points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 4 : 2.5} fill="#FFFFFF" />
      ))}
    </svg>
  );
}

/**
 * Tarjeta de la próxima sesión: el bloque más rotundo de la pantalla, porque
 * es lo que va a pasar dentro de un rato.
 *
 * Lo que la maqueta pide y aquí NO se pinta, porque no existe en el esquema:
 * la sala o despacho. La modalidad sí se deriva —una cita con enlace de
 * videollamada es online, y sin él, presencial—, así que esa sí se dice.
 */
export function TarjetaProximaSesion({
  sesion,
  ahoraISO,
}: {
  sesion: ProximaSesion | null;
  ahoraISO: string;
}) {
  if (!sesion) {
    return (
      <div className="flex w-full flex-col justify-between gap-4 rounded-3xl bg-surface-muted p-6 lg:w-[500px] lg:shrink-0">
        <div>
          <p className="text-[17px] font-semibold text-ink">No tienes ninguna cita</p>
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            No hay ninguna sesión agendada por delante. Puedes crear una desde la
            agenda o proponérsela a quien lleva tiempo sin venir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/pro/agenda" className="btn-primary">
            Crear una cita
          </Link>
        </div>
      </div>
    );
  }

  // La sesión puede ser dentro de un rato o dentro de tres semanas, así que el
  // encabezado nombra el día cuando no es hoy: «a las 17:32» a secas induciría a
  // pensar que es hoy.
  const dia = nombreDelDia(sesion.inicioISO, sesion.diasHasta);
  const insignia = formatCuantoFalta(ahoraISO, sesion.inicioISO, sesion.diasHasta);

  return (
    <div
      className="flex w-full flex-col gap-3.5 rounded-3xl p-5 lg:w-[500px] lg:shrink-0"
      style={{ background: "var(--accent-solid)", color: "var(--accent-solid-ink)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13.5px]" style={{ color: "var(--accent-on-dark)" }}>
          Siguiente sesión{dia ? ` ${dia}` : ""} a las {formatTime(sesion.inicioISO)}
        </span>
        <span
          className="shrink-0 rounded px-2.5 py-0.5 text-[13.5px] font-semibold"
          style={{ background: "#FFFFFF", color: "var(--accent-solid)" }}
        >
          {insignia}
        </span>
      </div>

      <div>
        <p className="text-[26px] leading-[1.1] font-semibold tracking-[-0.02em]">
          {sesion.paciente}
        </p>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--accent-on-dark)" }}>
          Sesión {sesion.numeroSesion}, {sesion.online ? "online" : "presencial"}
        </p>
      </div>

      <div
        className="flex flex-wrap items-end gap-4 border-t pt-3"
        style={{ borderColor: "rgba(255,255,255,0.18)" }}
      >
        {/* 160 y no 180: a 390 px de pantalla, con los 16 de margen de página y
            los 20 de la tarjeta, quedan 318 útiles. Con 180 + 16 de hueco + 120
            de la columna de cifras son 316, y cabía por dos píxeles. */}
        <div className="min-w-[160px] flex-1">
          {sesion.escala ? (
            <>
              <p className="mb-1.5 text-[12.5px]" style={{ color: "var(--accent-on-dark)" }}>
                {sesion.escala.codigo} en sus últimas {sesion.escala.puntos.length}{" "}
                {sesion.escala.puntos.length === 1 ? "toma" : "tomas"}
              </p>
              <Tendencia puntos={sesion.escala.puntos} escala={sesion.escala.codigo} />
            </>
          ) : (
            <p className="text-[12.5px]" style={{ color: "var(--accent-on-dark)" }}>
              Sin escalas respondidas. Se activan en su ficha, pestaña Escalas.
            </p>
          )}
        </div>

        <div
          className="w-[120px] shrink-0 text-[13px] leading-[1.6]"
          style={{ color: "var(--accent-on-dark)" }}
        >
          {sesion.escala && sesion.escala.puntos.length > 0 && (
            <div>
              Última:{" "}
              <strong style={{ color: "#FFFFFF" }} className="font-semibold">
                {sesion.escala.puntos.at(-1)?.score}
              </strong>
            </div>
          )}
          {sesion.tareas && (
            <div>
              Tareas: {sesion.tareas.hechas} de {sesion.tareas.total}
            </div>
          )}
          {sesion.diarioDias != null && <div>Diario: {sesion.diarioDias} de 7 días</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/pro/patients/${sesion.patientId}`}
          className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13.5px] font-semibold"
          style={{ background: "#FFFFFF", color: "var(--ink-1)" }}
        >
          Abrir ficha
        </Link>
        {sesion.escala && (
          <Link
            href={`/pro/patients/${sesion.patientId}?tab=escalas`}
            className="inline-flex h-9 items-center rounded-lg border px-3.5 text-[13.5px] font-medium"
            style={{ borderColor: "rgba(255,255,255,0.35)", color: "#FFFFFF" }}
          >
            Ver respuestas de la escala
          </Link>
        )}
      </div>
    </div>
  );
}
