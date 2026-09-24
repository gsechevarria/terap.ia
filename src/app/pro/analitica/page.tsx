import Link from "next/link";
import { getProfessionalAnalytics } from "@/lib/queries/analytics";
import { formatCurrency } from "@/lib/format";
import { ymdParts } from "@/lib/tz";

/** «sept», con el año en enero para que se vea el cambio. */
function etiquetaMes(ym: string, primero: boolean): string {
  const [y, m] = ymdParts(`${ym}-01`);
  const d = new Date(Date.UTC(y, m - 1, 1, 12));
  const mes = d.toLocaleDateString("es-ES", { timeZone: "UTC", month: "short" });
  return primero || m === 1 ? `${mes} ${String(y).slice(2)}` : mes;
}
function rangoMes(ym: string): string {
  const [y, m] = ymdParts(`${ym}-01`);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `from=${ym}-01&to=${ym}-${String(ultimo).padStart(2, "0")}`;
}
/** Importe sin céntimos, para rótulos cortos: «1.040 €». */
function eurosCortos(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
function pct(parte: number, total: number): string {
  return total > 0 ? `${Math.round((parte / total) * 100)} %` : "—";
}

/**
 * Analítica de la consulta, en una sola pantalla de escritorio.
 *
 * Seis cifras arriba, dos series en medio y tres bloques de detalle abajo, cada
 * zona separada por una línea y no por cajas. Antes eran tres gráficas a todo
 * el ancho, una debajo de otra, con `BarChart` —un SVG escalado al ancho, que
 * en una hoja ancha dejaba rótulos de 22 px— y había que desplazar para verlo.
 *
 * Qué se ha quitado y por qué: la «evolución agregada de escalas», que hacía la
 * media mensual de puntuaciones de pacientes distintos. No describe a nadie y se
 * lee como una tendencia clínica de la consulta, que es justo lo que el
 * producto no hace. De escalas queda lo operativo.
 *
 * Qué se ha añadido: pacientes sin próxima cita, sesiones y horas del mes frente
 * al anterior, pendiente de cobro, la asistencia desglosada —incluidas las
 * pasadas sin marcar, que falsean todo lo demás—, cuándo se concentra el
 * trabajo, y cuánto usan la aplicación los pacientes entre sesiones.
 */
export default async function AnalyticsPage() {
  const ahora = new Date();
  const a = await getProfessionalAnalytics(ahora);

  if (!a) {
    return (
      <div>
        <h1 className="page-title">Analítica</h1>
        <p className="empty mt-6">No se ha podido identificar tu cuenta profesional.</p>
      </div>
    );
  }

  const registradas = a.asistencia.acudio + a.asistencia.noAcudio + a.asistencia.canceloTarde;
  const totalAsistencia = registradas + a.asistencia.cancelada + a.asistencia.sinMarcar;
  const totalFranjas = a.franjas.manana + a.franjas.tarde;

  const frase = [
    a.sesiones.esteMes > 0
      ? `Este mes llevas ${a.sesiones.esteMes} ${a.sesiones.esteMes === 1 ? "sesión realizada" : "sesiones realizadas"} y ${formatCurrency(a.dinero.esteMes)} cobrados.`
      : `Este mes todavía no hay sesiones registradas como realizadas.`,
    a.asistencia.tasa != null
      ? `En los últimos 90 días acudió el ${Math.round(a.asistencia.tasa * 100)} % de las citas con asistencia marcada.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="page-title">Analítica</h1>
        <p className="mt-3 max-w-[720px] text-body-lg text-ink-2">{frase}</p>
      </header>

      {/* ---- Las seis cifras. Las que llevan a un listado son enlaces. */}
      <section
        aria-label="Cifras de la consulta"
        className="grid grid-cols-2 gap-x-7 gap-y-5 sm:grid-cols-3 xl:grid-cols-6"
      >
        <Cifra
          rotulo="Pacientes activos"
          valor={String(a.pacientes.activos)}
          pie={`${a.pacientes.nuevosEsteMes} ${a.pacientes.nuevosEsteMes === 1 ? "nuevo" : "nuevos"} este mes, ${a.pacientes.archivados} archivados`}
          href="/pro/patients"
        />
        <Cifra
          rotulo="Sin próxima cita"
          valor={String(a.pacientes.sinProximaCita)}
          pie={`de ${a.pacientes.activos} activos`}
          href="/pro/patients"
        />
        <Cifra
          rotulo="Sesiones este mes"
          valor={String(a.sesiones.esteMes)}
          pie={`${a.sesiones.horasEsteMes} h. El mes pasado, ${a.sesiones.mesAnterior}`}
          href="/pro/agenda/citas"
        />
        <Cifra
          rotulo="Asistencia, 90 días"
          valor={a.asistencia.tasa != null ? `${Math.round(a.asistencia.tasa * 100)} %` : "—"}
          pie={
            a.asistencia.tasa != null
              ? `${a.asistencia.noAcudio} sin avisar, ${a.asistencia.canceloTarde} tarde`
              : "sin asistencia marcada"
          }
        />
        <Cifra
          rotulo="Cobrado este mes"
          valor={formatCurrency(a.dinero.esteMes)}
          pie={`el mes pasado, ${formatCurrency(a.dinero.mesAnterior)}`}
          href="/pro/pagos"
        />
        <Cifra
          rotulo="Pendiente de cobro"
          valor={formatCurrency(a.dinero.pendiente)}
          pie="de todos los meses"
          href="/pro/pagos/historico?status=pending"
        />
      </section>

      {/* ---- Las dos series, lado a lado. */}
      <div className="grid gap-x-10 gap-y-6 border-t border-line pt-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Bloque titulo="Sesiones por semana" nota="Últimas 12, sin las canceladas">
          <Barras
            alto={110}
            eje={(n) => String(n)}
            columnas={a.semanas.map((s) => ({
              clave: s.inicioYMD,
              etiqueta: s.etiqueta,
              valor: s.sesiones,
              texto: String(s.sesiones),
              resaltada: s.enCurso,
              title: `Semana del ${s.etiqueta}: ${s.sesiones} ${s.sesiones === 1 ? "sesión" : "sesiones"}`,
              href: `/pro/agenda?date=${s.inicioYMD}`,
            }))}
          />
        </Bloque>
        <Bloque titulo="Cobrado por mes" nota="Últimos 6, solo lo cobrado">
          <Barras
            alto={110}
            eje={eurosCortos}
            columnas={a.meses.map((m, i) => ({
              clave: m.mes,
              etiqueta: etiquetaMes(m.mes, i === 0),
              valor: m.cents,
              texto: m.cents > 0 ? eurosCortos(m.cents) : "0 €",
              resaltada: m.enCurso,
              title: `${etiquetaMes(m.mes, true)}: ${formatCurrency(m.cents)}`,
              href: `/pro/pagos/historico?status=paid&${rangoMes(m.mes)}`,
            }))}
          />
        </Bloque>
      </div>
      <p className="-mt-2 flex items-center gap-2 text-[12px] text-ink-3">
        <span aria-hidden className="h-2.5 w-3.5 rounded-xs" style={{ background: "var(--green-2)" }} />
        Semana y mes en curso, todavía abiertos.
      </p>

      {/* ---- Tres bloques de detalle. */}
      <div className="grid gap-x-10 gap-y-6 border-t border-line pt-5 md:grid-cols-3">
        <Bloque titulo="Asistencia" nota="Citas pasadas, últimos 90 días">
          {totalAsistencia === 0 ? (
            <Vacio>No hay citas pasadas en los últimos 90 días.</Vacio>
          ) : (
            <ul className="flex flex-col gap-2">
              <Reparto rotulo="Acudió" n={a.asistencia.acudio} total={totalAsistencia} tono="var(--green-5)" />
              <Reparto rotulo="No acudió sin avisar" n={a.asistencia.noAcudio} total={totalAsistencia} tono="var(--green-4)" />
              <Reparto rotulo="Marcadas como cancelación tardía" n={a.asistencia.canceloTarde} total={totalAsistencia} tono="var(--green-3)" />
              <Reparto rotulo="Canceladas" n={a.asistencia.cancelada} total={totalAsistencia} tono="var(--green-2)" />
              {a.asistencia.sinMarcar > 0 && (
                <li className="text-[12.5px] text-warning-ink">
                  {a.asistencia.sinMarcar}{" "}
                  {a.asistencia.sinMarcar === 1 ? "cita pasada" : "citas pasadas"} sin asistencia
                  marcada.{" "}
                  <Link href="/pro/agenda/citas" className="font-medium underline underline-offset-2">
                    Marcarlas
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Bloque>

        <Bloque titulo="Cuándo trabajas" nota="Sesiones de las últimas 12 semanas">
          {totalFranjas === 0 ? (
            <Vacio>Sin sesiones en las últimas 12 semanas.</Vacio>
          ) : (
            <>
              <Barras
                alto={64}
                columnas={a.porDia.map((d) => ({
                  clave: d.etiqueta,
                  etiqueta: d.etiqueta,
                  valor: d.sesiones,
                  texto: String(d.sesiones),
                  title: `${d.sesiones} ${d.sesiones === 1 ? "sesión" : "sesiones"}`,
                }))}
              />
              <p className="mt-3 text-[13px] text-ink-2">
                Mañanas {pct(a.franjas.manana, totalFranjas)}, tardes{" "}
                {pct(a.franjas.tarde, totalFranjas)}.
                <span className="text-ink-3"> La tarde empieza a las 14:00.</span>
              </p>
            </>
          )}
        </Bloque>

        <Bloque titulo="Entre sesiones" nota="Pacientes activos, últimos 30 días">
          <dl className="text-[13px]">
            <Fila
              rotulo="Con cuenta en la aplicación"
              valor={`${a.app.activosConCuenta} de ${a.app.activos}`}
            />
            <Fila
              rotulo="Registran el diario"
              valor={`${a.app.usanDiario} ${a.app.usanDiario === 1 ? "paciente" : "pacientes"}`}
            />
            <Fila
              rotulo="Tareas completadas"
              valor={
                a.app.tareasAsignadas > 0
                  ? `${a.app.tareasCompletadas} de ${a.app.tareasAsignadas}`
                  : "ninguna asignada"
              }
            />
            <Fila
              rotulo="Con escalas activas"
              valor={`${a.app.conEscalaActiva}, ${a.app.respuestasEscala} ${a.app.respuestasEscala === 1 ? "respuesta" : "respuestas"}`}
            />
            <Fila
              rotulo="Ítems de riesgo sin revisar"
              valor={
                a.app.riesgoSinRevisar > 0 ? (
                  <Link
                    href="/pro/patients"
                    className="font-semibold text-danger underline underline-offset-2"
                  >
                    {a.app.riesgoSinRevisar}, revisar
                  </Link>
                ) : (
                  "ninguno"
                )
              }
            />
          </dl>
        </Bloque>
      </div>

      <p className="text-[12px] text-ink-4">
        Datos descriptivos de agenda, cobros y uso de la aplicación. Ninguna cifra
        interpreta nada clínico.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ piezas --- */

/** Cifra sin caja, como las de «Hoy» y «Pagos». Enlace si lleva a un listado. */
function Cifra({
  rotulo,
  valor,
  pie,
  href,
}: {
  rotulo: string;
  valor: string;
  pie: string;
  href?: string;
}) {
  const cuerpo = (
    <>
      <div className="text-[13px] text-ink-3">{rotulo}</div>
      <div className={`figure mt-1 ${href ? "group-hover:text-accent" : ""}`}>{valor}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-2">{pie}</div>
    </>
  );
  return href ? (
    <Link href={href} className="group block min-w-0">
      {cuerpo}
    </Link>
  ) : (
    <div className="min-w-0">{cuerpo}</div>
  );
}

function Bloque({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <h2 className="section-title">
        {titulo} <span className="text-[13px] font-normal text-ink-4">{nota}</span>
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

type Columna = {
  clave: string;
  etiqueta: string;
  valor: number;
  texto: string;
  resaltada?: boolean;
  title: string;
  href?: string;
};

/**
 * Barras verticales con el trazado de «Ocupación de tu agenda»: alto fijo, eje
 * abajo, techo y mitad a la izquierda si se pide, y el valor escrito debajo de
 * cada barra para que el verde no sea el único portador del dato.
 */
function Barras({
  columnas,
  alto,
  eje,
}: {
  columnas: Columna[];
  alto: number;
  eje?: (n: number) => string;
}) {
  const maximo = Math.max(...columnas.map((c) => c.valor), 1);
  const techo = eje ? techoRedondo(maximo) : maximo;
  const sangria = eje ? "pl-12" : "";

  return (
    <div>
      <div
        className={`relative flex items-end gap-1 sm:gap-1.5 ${sangria}`}
        style={{ height: alto, borderBottom: "1px solid var(--line-strong)" }}
      >
        {eje && (
          <>
            <span className="absolute top-[-7px] left-0 text-[11px] text-ink-3">{eje(techo)}</span>
            <span
              className="absolute left-0 text-[11px] text-ink-4"
              style={{ top: alto / 2 - 7 }}
            >
              {eje(techo / 2)}
            </span>
          </>
        )}
        {columnas.map((c) => {
          const barra = (
            <span
              className="block w-full rounded-t-sm"
              style={{
                height: `${Math.max(c.valor > 0 ? 2 : 0, Math.round((c.valor / techo) * 100))}%`,
                background: c.resaltada ? "var(--green-2)" : "var(--accent-solid)",
              }}
            />
          );
          return c.href ? (
            <Link
              key={c.clave}
              href={c.href}
              title={c.title}
              aria-label={c.title}
              className="flex h-full flex-1 items-end rounded-t-sm transition-colors hover:bg-surface-subtle"
            >
              {barra}
            </Link>
          ) : (
            <div key={c.clave} title={c.title} className="flex h-full flex-1 items-end">
              {barra}
            </div>
          );
        })}
      </div>
      <div aria-hidden className={`mt-1 flex gap-1 sm:gap-1.5 ${sangria}`}>
        {columnas.map((c) => (
          <span key={c.clave} className="min-w-0 flex-1 text-center text-[11px] leading-tight">
            <span className="block truncate text-ink-4">{c.etiqueta}</span>
            <span className={`block truncate ${c.valor > 0 ? "text-ink-2" : "text-ink-4"}`}>
              {c.texto}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Techo del eje: el máximo redondeado hacia arriba a 1, 2 o 5 por potencia de 10. */
function techoRedondo(n: number): number {
  const potencia = 10 ** Math.floor(Math.log10(n));
  for (const f of [1, 2, 5, 10]) if (f * potencia >= n) return f * potencia;
  return 10 * potencia;
}

/** Fila de reparto: rótulo, recuento y porcentaje escritos, barra fina debajo. */
function Reparto({
  rotulo,
  n,
  total,
  tono,
}: {
  rotulo: string;
  n: number;
  total: number;
  tono: string;
}) {
  const p = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate text-ink">{rotulo}</span>
        <span className="shrink-0 text-ink-2">
          {n}
          <span className="ml-1.5 text-ink-4">{p} %</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-surface-muted">
        <div className="h-full rounded-sm" style={{ width: `${n > 0 ? Math.max(p, 2) : 0}%`, background: tono }} />
      </div>
    </li>
  );
}

function Fila({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 py-[7px]"
      style={{ borderBottom: "1px solid var(--line-soft)" }}
    >
      <dt className="min-w-0 text-ink-2">{rotulo}</dt>
      <dd className="shrink-0 text-right font-medium text-ink">{valor}</dd>
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-[13.5px] text-ink-3">{children}</p>;
}
