import Link from "next/link";

/** Landing pública. Server component sin JS de cliente. */
export default function Home() {
  return (
    <main className="flex-1">
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Wordmark />
        <Link href="/login" className="btn-ghost">
          Acceder
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-3xl px-6 pt-16 pb-14 text-center sm:pt-24">
        <p className="section-label">Para psicólogos de consulta privada</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.02em] text-balance sm:text-6xl">
          Tu consulta, en calma.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-2 text-pretty">
          terap.ia reúne tareas terapéuticas, agenda, cuestionarios opt-in,
          diario emocional y pagos en un espacio sencillo que compartes con
          cada paciente.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/login" className="btn-primary h-10 px-5 text-[15px]">
            Acceder
          </Link>
          <a href="#producto" className="btn-subtle h-10 px-4 text-[15px]">
            Cómo funciona
          </a>
        </div>
        <p className="mt-4 text-xs text-ink-3">
          Acceso por enlace mágico — sin contraseñas.
        </p>
        {/* Motivo: la escala de ánimo 1–5 del diario emocional */}
        <div
          aria-hidden
          className="mt-12 flex items-center justify-center gap-2.5"
        >
          <span className="size-1.5 rounded-full bg-accent opacity-20" />
          <span className="size-1.5 rounded-full bg-accent opacity-40" />
          <span className="size-1.5 rounded-full bg-accent opacity-60" />
          <span className="size-1.5 rounded-full bg-accent opacity-80" />
          <span className="size-1.5 rounded-full bg-accent" />
        </div>
      </section>

      {/* Maqueta del producto */}
      <section id="producto" className="mx-auto w-full max-w-4xl scroll-mt-8 px-6">
        <AppWindow />
      </section>

      {/* Qué incluye */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">
          Todo el acompañamiento, en un solo lugar
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            title="Pacientes y tareas"
            text="Ficha por paciente con tareas terapéuticas, notas privadas y todo el historial de la relación."
          />
          <Feature
            title="Agenda y citas"
            text="Citas con recurrencia, registro de asistencia, bloqueos y archivo .ics para cualquier calendario."
          />
          <Feature
            title="Escalas clínicas, opt-in"
            text="PHQ-9 y GAD-7 solo si tú las activas para un paciente. Evolución en gráfica y export CSV."
          />
          <Feature
            title="Diario emocional"
            text="El paciente registra su ánimo; tú observas la evolución. Sin interpretación automática."
          />
          <Feature
            title="Pagos, sin facturas"
            text="Precios, bonos, deuda y export para tu gestoría. La aplicación nunca emite facturas."
          />
          <Feature
            title="Analítica de consulta"
            text="Ocupación, no-shows e ingresos por mes. Descriptiva y anónima."
          />
        </div>
      </section>

      {/* Principios */}
      <section className="border-y border-line bg-panel">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.01em]">
              Hecha para la práctica clínica europea
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Las decisiones de producto están tomadas para que la herramienta
              acompañe sin interferir en tu criterio clínico.
            </p>
          </div>
          <ul className="space-y-4 text-sm leading-relaxed text-ink">
            <Principle text="Datos alojados en la Unión Europea (Fráncfort), aislados por consulta a nivel de base de datos." />
            <Principle text="Los cuestionarios solo existen para un paciente si tú los activas. Sin activación, no ve ninguno." />
            <Principle text="Nada interpreta ni recomienda clínicamente. Las puntuaciones se calculan; la lectura es tuya." />
            <Principle text="Seguimiento económico completo sin emisión de facturas." />
          </ul>
        </div>
      </section>

      {/* Cierre */}
      <section className="mx-auto w-full max-w-3xl px-6 py-20 text-center">
        <h2 className="text-2xl font-semibold tracking-[-0.01em]">
          Empieza con tu correo
        </h2>
        <p className="mt-2 text-ink-2">
          Sin contraseñas, sin instalación. Tus pacientes entran por invitación.
        </p>
        <Link href="/login" className="btn-primary mt-6 h-10 px-5 text-[15px]">
          Acceder a terap.ia
        </Link>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-ink-3 sm:flex-row">
          <Wordmark small />
          <p>Entorno de demostración con datos ficticios · © 2026 terap.ia</p>
        </div>
      </footer>
    </main>
  );
}

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 font-semibold tracking-[-0.01em] text-ink ${
        small ? "text-sm" : "text-lg"
      }`}
    >
      terap.ia
      <span aria-hidden className="size-1.5 self-center rounded-full bg-accent" />
    </span>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-canvas p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}

function Principle({ text }: { text: string }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent"
      />
      <span>{text}</span>
    </li>
  );
}

/* Maqueta estática del panel profesional (solo HTML/CSS, datos ficticios). */
function AppWindow() {
  return (
    <div className="card overflow-hidden shadow-[0_16px_40px_-24px_rgba(15,15,15,0.25)]">
      {/* Barra de ventana */}
      <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full border border-line bg-canvas" />
          <span className="size-2.5 rounded-full border border-line bg-canvas" />
          <span className="size-2.5 rounded-full border border-line bg-canvas" />
        </span>
        <span className="mx-auto text-[11px] text-ink-3">
          terap.ia — Pacientes
        </span>
      </div>
      <div className="flex text-left">
        {/* Sidebar */}
        <div className="hidden w-40 shrink-0 border-r border-line bg-panel px-2 py-3 sm:block">
          <p className="px-2 pb-2 text-[10px] font-semibold tracking-wide text-ink-3 uppercase">
            Consulta
          </p>
          {["Pacientes", "Agenda", "Pagos", "Analítica", "Ajustes"].map(
            (item, i) => (
              <span
                key={item}
                className={`block rounded px-2 py-1 text-[12px] ${
                  i === 0
                    ? "bg-wash-2 font-medium text-ink"
                    : "text-ink-2"
                }`}
              >
                {item}
              </span>
            ),
          )}
        </div>
        {/* Lista de pacientes */}
        <div className="min-w-0 flex-1 px-5 py-4">
          <p className="text-[13px] font-semibold">Pacientes</p>
          <div className="mt-3 divide-y divide-line">
            <MockRow
              name="Ana Nadal"
              detail="PHQ-9 respondido hoy"
              chip="ansiedad"
              alert="Ítem 9 · revisar"
            />
            <MockRow
              name="Marc Vidal"
              detail="Próxima cita · jueves 10:00"
              chip="pareja"
            />
            <MockRow name="Lucía Ferrer" detail="3 tareas pendientes" />
            <MockRow
              name="Joan Serra"
              detail="Bono · quedan 4 sesiones"
              chip="duelo"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockRow({
  name,
  detail,
  chip,
  alert,
}: {
  name: string;
  detail: string;
  chip?: string;
  alert?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-panel text-[10px] font-semibold text-ink-2">
        {name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium">{name}</p>
        <p className="truncate text-[11px] text-ink-3">{detail}</p>
      </div>
      {alert && (
        <span className="rounded-sm bg-danger-soft px-1.5 py-px text-[10px] font-medium text-danger">
          {alert}
        </span>
      )}
      {chip && (
        <span className="hidden rounded-sm bg-panel px-1.5 py-px text-[10px] text-ink-2 sm:inline">
          {chip}
        </span>
      )}
    </div>
  );
}
