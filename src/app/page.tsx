import Link from "next/link";
import { Angry, Frown, Meh, Smile, Laugh } from "lucide-react";
import { Brandmark } from "@/components/ui/Brandmark";

/**
 * Landing pública, estructura tipo notion.com:
 * nav con menú → hero con pila de tarjetas → muro de logos → automatizaciones →
 * showcases de producto → grid "reúne todo" → testimonios → métricas → CTA →
 * footer de columnas. Server component sin JS de cliente; todos los visuales
 * son HTML/CSS/SVG propios (datos ficticios).
 */

const BLUE = "bg-[#2383e2] hover:bg-[#1b74c9] text-white";

export default function Home() {
  return (
    <main className="flex-1 overflow-x-clip">
      <SiteNav />
      <Hero />
      <LogoWall />
      <Automations />
      <ShowcasePanel />
      <ShowcaseSplit />
      <PatientSection />
      <EverythingGrid />
      <Testimonials />
      <Stats />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}

/* ---------------------------------------------------------------- nav --- */

function SiteNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-6">
          <Wordmark />
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <a href="#producto" className="rounded px-2.5 py-1.5 font-medium text-ink transition-colors hover:bg-wash">
              Producto
            </a>
            <a href="#paciente" className="rounded px-2.5 py-1.5 font-medium text-ink transition-colors hover:bg-wash">
              Para el paciente
            </a>
            <a href="#principios" className="rounded px-2.5 py-1.5 font-medium text-ink transition-colors hover:bg-wash">
              Principios
            </a>
            <a href="#testimonios" className="rounded px-2.5 py-1.5 font-medium text-ink transition-colors hover:bg-wash">
              Consultas
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded px-2.5 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-wash sm:block"
          >
            Inicia sesión
          </Link>
          <span aria-hidden className="hidden h-4 w-px bg-line sm:block" />
          <Link
            href="/login"
            className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${BLUE}`}
          >
            Consigue terap.ia gratis
          </Link>
        </div>
      </div>
    </header>
  );
}

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center">
      <Brandmark height={small ? 28 : 40} />
    </Link>
  );
}

/* --------------------------------------------------------------- hero --- */

function Hero() {
  return (
    <section className="relative mx-auto w-full max-w-5xl px-5 pt-16 pb-10 text-center sm:pt-24">
      <DoodleSparkle className="absolute top-14 left-6 hidden w-10 text-ink md:block" />
      <DoodleSquiggle className="absolute top-32 right-4 hidden w-16 text-ink md:block" />

      <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
        Donde terapeuta y paciente avanzan codo con codo.
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-2 text-pretty sm:text-xl">
        Guarda el contexto de cada paciente, sigue su evolución y automatiza el
        seguimiento con un espacio creado para tu consulta.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className={`rounded-md px-5 py-2.5 text-[15px] font-semibold transition-colors ${BLUE}`}
        >
          Consigue terap.ia gratis
        </Link>
        <a
          href="#producto"
          className="rounded-md bg-panel px-5 py-2.5 text-[15px] font-semibold text-ink transition-colors hover:bg-wash-2"
        >
          Solicita una demo
        </a>
      </div>
      <p className="mt-4 text-xs text-ink-3">
        Acceso por enlace mágico · tus pacientes entran por invitación
      </p>

      <CardPile />
    </section>
  );
}

/** Pila de tarjetas apiladas del hero (como las "piles" de notion.com). */
function CardPile() {
  const cards: {
    icon: React.ReactNode;
    title: string;
    sub: string;
    rotate: string;
    y: string;
  }[] = [
    { icon: <IconCalendar />, title: "Cita confirmada", sub: "jueves · 10:00", rotate: "-rotate-6", y: "translate-y-4" },
    { icon: <IconSmile />, title: "Ánimo de hoy", sub: "4 / 5 — «mejor semana»", rotate: "rotate-2", y: "-translate-y-1" },
    { icon: <IconChart />, title: "PHQ-9", sub: "6 pts · leve ↓", rotate: "-rotate-2", y: "translate-y-2" },
    { icon: <IconCheck />, title: "Tarea hecha", sub: "Diario de gratitud", rotate: "rotate-6", y: "-translate-y-2" },
    { icon: <IconTicket />, title: "Bono 10", sub: "quedan 4 sesiones", rotate: "-rotate-3", y: "translate-y-3" },
    { icon: <IconBell />, title: "Recordatorio", sub: "enviado hace 2 h", rotate: "rotate-3", y: "translate-y-1" },
    { icon: <IconPen />, title: "Consentimiento", sub: "firmado · alta completa", rotate: "-rotate-1", y: "-translate-y-3" },
  ];
  return (
    <div
      aria-hidden
      className="mt-14 flex items-end justify-center [--overlap:-0.9rem] sm:[--overlap:-0.5rem]"
    >
      {cards.map((c, i) => (
        <div
          key={c.title}
          className={`w-32 shrink-0 rounded-lg border border-line bg-canvas p-3 text-left shadow-[0_12px_24px_-16px_rgba(15,15,15,0.35)] transition-transform duration-200 hover:z-10 hover:-translate-y-3 hover:rotate-0 sm:w-36 ${c.rotate} ${c.y} ${
            i > 0 ? "ml-[var(--overlap)]" : ""
          } ${i > 4 ? "hidden md:block" : ""} ${i > 3 && i <= 4 ? "hidden sm:block" : ""}`}
        >
          <span className="flex size-7 items-center justify-center rounded bg-panel text-ink">
            {c.icon}
          </span>
          <p className="mt-2 truncate text-[12px] font-semibold">{c.title}</p>
          <p className="truncate text-[11px] text-ink-3">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- logo wall --- */

function LogoWall() {
  const clinics = [
    { name: "Centro Aluna", cls: "font-serif italic" },
    { name: "PSICOVIVES", cls: "font-bold tracking-widest" },
    { name: "Clínica Mendoza", cls: "font-semibold" },
    { name: "espacio kora", cls: "lowercase tracking-wide" },
    { name: "Gabinet Serra", cls: "font-serif font-bold" },
    { name: "ALBA psicoterapia", cls: "font-medium tracking-tight" },
    { name: "Institut Cadència", cls: "font-serif" },
    { name: "MINDARA", cls: "font-bold tracking-[0.2em]" },
  ];
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 text-center">
      <p className="text-sm font-medium text-ink-2">
        Consultas privadas de toda España ya acompañan con terap.ia
      </p>
      <div className="mt-8 grid grid-cols-2 items-center gap-x-6 gap-y-7 opacity-60 grayscale sm:grid-cols-4">
        {clinics.map((c) => (
          <span key={c.name} className={`text-lg text-ink-2 ${c.cls}`}>
            {c.name}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------ automatizaciones --- */

function Automations() {
  const items = [
    {
      icon: <IconBell />,
      title: "Recordatorios de cita",
      text: "24-48 h antes, por push. Sin que tengas que acordarte tú.",
    },
    {
      icon: <IconTicket />,
      title: "Bonos que se consumen solos",
      text: "Marcas «acudió» y la sesión se descuenta del bono o queda pendiente de pago.",
    },
    {
      icon: <IconAlert />,
      title: "Alertas de riesgo al instante",
      text: "Si un PHQ-9 marca el ítem 9, lo ves destacado en tu panel al momento.",
    },
    {
      icon: <IconRepeat />,
      title: "Escalas recurrentes",
      text: "Actívalas una vez y el cuestionario reaparece cada X días, solo para ese paciente.",
    },
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16">
      <p className="section-label">Automatizaciones</p>
      <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
        Mantén la consulta en marcha las 24 horas
      </h2>
      <p className="mt-3 max-w-xl text-ink-2">
        Las tareas repetitivas del seguimiento, resueltas. Tú pones el criterio
        clínico; terap.ia pone la constancia.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-2xl bg-panel p-6 transition-transform duration-200 hover:-translate-y-1"
          >
            <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-canvas text-ink">
              {it.icon}
            </span>
            <h3 className="mt-4 text-[15px] font-semibold">{it.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{it.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------- showcase: panel pro --- */

function ShowcasePanel() {
  return (
    <section id="producto" className="mx-auto w-full max-w-6xl scroll-mt-16 px-5 py-16">
      <div className="rounded-3xl bg-panel px-5 pt-12 sm:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-label">Panel profesional</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Toda tu consulta, de un vistazo
          </h2>
          <p className="mt-3 text-ink-2">
            Pacientes con su próxima cita, tareas pendientes y alertas — sin
            abrir carpetas ni buscar en hojas de cálculo.
          </p>
        </div>
        <div className="mt-10 overflow-hidden rounded-t-2xl border border-b-0 border-line shadow-[0_-16px_48px_-32px_rgba(15,15,15,0.4)]">
          <DesktopMock />
        </div>
      </div>
    </section>
  );
}

/** Maqueta grande del dashboard /pro (solo HTML/CSS, datos ficticios). */
function DesktopMock() {
  return (
    <div className="bg-canvas text-left">
      {/* Barra de ventana */}
      <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#f96057]" />
          <span className="size-2.5 rounded-full bg-[#f8ce52]" />
          <span className="size-2.5 rounded-full bg-[#5fcf65]" />
        </span>
        <span className="mx-auto flex items-center gap-1.5 rounded bg-canvas px-8 py-0.5 text-[11px] text-ink-3">
          <IconLock /> app.terap.ia/pro
        </span>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden w-48 shrink-0 border-r border-line bg-panel px-2.5 py-4 sm:block">
          <div className="flex items-center gap-2 px-2 pb-3">
            <span className="flex size-5 items-center justify-center rounded bg-accent text-[10px] font-bold text-white">
              R
            </span>
            <span className="text-[12px] font-semibold">Consulta Romero</span>
          </div>
          {[
            ["Pacientes", true],
            ["Agenda", false],
            ["Pagos", false],
            ["Analítica", false],
            ["Ajustes", false],
          ].map(([label, active]) => (
            <span
              key={label as string}
              className={`block rounded px-2 py-1 text-[12px] ${
                active ? "bg-wash-2 font-medium text-ink" : "text-ink-2"
              }`}
            >
              {label as string}
            </span>
          ))}
          <p className="px-2 pt-4 pb-1 text-[10px] font-semibold tracking-wide text-ink-3 uppercase">
            Esta semana
          </p>
          <span className="block px-2 py-0.5 text-[12px] text-ink-2">12 citas</span>
          <span className="block px-2 py-0.5 text-[12px] text-ink-2">3 cuestionarios</span>
        </div>
        {/* Main */}
        <div className="min-w-0 flex-1 px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold">Pacientes</p>
              <p className="text-[11px] text-ink-3">8 activos</p>
            </div>
            <span className="rounded bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">
              Nuevo paciente
            </span>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded border border-danger/25 bg-danger-soft px-3 py-2 text-[11px] text-danger">
            <span aria-hidden className="mt-[5px] size-1 rounded-full bg-danger" />
            <span>
              <b>Alertas por revisar:</b> Ana Nadal — PHQ-9, ítem 9 marcado
            </span>
          </div>
          <div className="mt-3 divide-y divide-line rounded-lg border border-line">
            <MockRow name="Ana Nadal" detail="PHQ-9 respondido hoy · 14 pts" chip="ansiedad" alert="revisar" />
            <MockRow name="Marc Vidal" detail="Próxima cita · jueves 10:00" chip="pareja" />
            <MockRow name="Lucía Ferrer" detail="3 tareas pendientes · diario al día" chip="TCA" />
            <MockRow name="Joan Serra" detail="Bono · quedan 4 sesiones" chip="duelo" />
            <MockRow name="Elena Costa" detail="GAD-7 recurrente · próximo en 6 días" chip="quincenal" />
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
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-panel text-[10px] font-semibold text-ink-2">
        {name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium">{name}</p>
        <p className="truncate text-[11px] text-ink-3">{detail}</p>
      </div>
      {alert && (
        <span className="rounded-sm bg-danger-soft px-1.5 py-px text-[10px] font-semibold text-danger">
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

/* ------------------------------------- showcase: evolución + agenda ----- */

function ShowcaseSplit() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-4 lg:grid-cols-2">
      {/* Evolución */}
      <div className="rounded-3xl bg-panel p-8 sm:p-10">
        <p className="section-label">Escalas opt-in</p>
        <h3 className="mt-2 text-2xl font-bold tracking-[-0.02em]">
          Evolución de diez, siempre
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          PHQ-9 y GAD-7 solo si tú los activas. Puntuación y severidad
          calculadas al momento, gráfica por paciente y export CSV.
        </p>
        <div className="mt-6 rounded-xl border border-line bg-canvas p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold">PHQ-9 · Ana N.</span>
            <span className="rounded-sm bg-panel px-1.5 py-px text-[10px] text-ink-2">
              últimos 3 meses
            </span>
          </div>
          <MiniChart />
          <div className="mt-2 flex items-center justify-between text-[10px] text-ink-3">
            <span>abril</span>
            <span className="font-medium text-accent">14 → 6 pts</span>
            <span>julio</span>
          </div>
        </div>
      </div>
      {/* Agenda */}
      <div className="rounded-3xl bg-panel p-8 sm:p-10">
        <p className="section-label">Agenda</p>
        <h3 className="mt-2 text-2xl font-bold tracking-[-0.02em]">
          La agenda que se lleva sola
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Citas con recurrencia, registro de asistencia y archivo .ics para
          Google o Apple Calendar. El paciente confirma desde su móvil.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {[
            { time: "09:00", name: "Marc Vidal", tag: "confirmada", ok: true },
            { time: "10:00", name: "Ana Nadal", tag: "videollamada", ok: true },
            { time: "12:00", name: "Joan Serra", tag: "por confirmar", ok: false },
          ].map((c) => (
            <div
              key={c.time}
              className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3"
            >
              <span className="text-[13px] font-bold tabular-nums">{c.time}</span>
              <span aria-hidden className="h-6 w-px bg-line" />
              <span className="flex-1 truncate text-[13px] font-medium">{c.name}</span>
              <span
                className={`rounded-sm px-1.5 py-px text-[10px] font-medium ${
                  c.ok ? "bg-accent-soft text-accent" : "bg-panel text-ink-2"
                }`}
              >
                {c.tag}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 px-1 pt-1 text-[11px] text-ink-3">
            <IconCalendar />
            <span>Añadir al calendario (.ics)</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Línea de evolución descendente (SVG estático). */
function MiniChart() {
  const pts = "0,18 30,26 60,22 90,38 120,34 150,48 180,44 210,58 240,54 270,62";
  return (
    <svg viewBox="0 0 270 80" className="mt-3 w-full" aria-hidden>
      {[20, 40, 60].map((y) => (
        <line key={y} x1="0" x2="270" y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 3" />
      ))}
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.split(" ").map((p) => {
        const [x, y] = p.split(",");
        return (
          <circle key={p} cx={x} cy={y} r="3" fill="var(--accent)" stroke="var(--canvas)" strokeWidth="1.5" />
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------- sección paciente ---- */

function PatientSection() {
  return (
    <section id="paciente" className="mx-auto w-full max-w-6xl scroll-mt-16 px-5 py-16">
      <div className="grid items-center gap-12 rounded-3xl border border-line px-6 py-12 sm:px-12 lg:grid-cols-2">
        <div>
          <p className="section-label">App del paciente</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            Acompañado también entre sesiones
          </h2>
          <p className="mt-4 leading-relaxed text-ink-2">
            Tu paciente entra por invitación, firma el consentimiento y tiene su
            espacio: registrar el ánimo, completar tareas, confirmar citas y
            responder cuestionarios. Instalable en el móvil como una app.
          </p>
          <ul className="mt-6 space-y-3 text-[15px]">
            {[
              "Diario emocional sin interpretación automática",
              "Botón de emergencia (024) siempre visible",
              "Recursos y documentos que tú compartes",
              "Sus pagos y bono, en claro",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-1 text-accent">
                  <IconCheck />
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-1 text-[15px] font-semibold text-[#2383e2] hover:underline"
          >
            Invita a tu primer paciente →
          </Link>
        </div>
        <PhoneMock />
      </div>
    </section>
  );
}

/** Maqueta de móvil con el home del paciente. */
function PhoneMock() {
  return (
    <div className="mx-auto w-full max-w-[290px]" aria-hidden>
      <div className="rounded-[2.4rem] border border-line bg-panel p-2.5 shadow-[0_32px_64px_-40px_rgba(15,15,15,0.5)]">
        <div className="overflow-hidden rounded-[2rem] border border-line bg-canvas">
          {/* status bar */}
          <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[10px] font-semibold text-ink">
            <span>9:41</span>
            <span className="h-4 w-16 rounded-full bg-panel" />
            <span>100%</span>
          </div>
          <div className="px-4 pt-2 pb-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold">Hola, Marc</span>
              <span className="rounded bg-danger px-1.5 py-0.5 text-[9px] font-bold text-white">
                024
              </span>
            </div>
            {/* mood */}
            <div className="mt-3 rounded-xl border border-line p-3">
              <p className="text-[11px] font-semibold">¿Cómo estás hoy?</p>
              <div className="mt-2 flex justify-between">
                {[Angry, Frown, Meh, Smile, Laugh].map((Face, i) => (
                  <span
                    key={i}
                    className={`flex size-9 items-center justify-center rounded-lg ${
                      i === 3
                        ? "border border-accent bg-accent-soft text-accent"
                        : "text-ink-3"
                    }`}
                  >
                    <Face className="size-5" strokeWidth={1.75} />
                  </span>
                ))}
              </div>
            </div>
            {/* cita */}
            <div className="mt-2.5 rounded-xl border border-line p-3">
              <p className="text-[9px] font-semibold tracking-wide text-ink-3 uppercase">
                Próxima cita
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[12px] font-semibold">jue 24 · 10:00</span>
                <span className="text-[11px] font-medium text-accent">
                  Videollamada
                </span>
              </div>
            </div>
            {/* tarea */}
            <div className="mt-2.5 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold">Diario de gratitud</p>
                  <p className="text-[10px] text-ink-3">para hoy</p>
                </div>
                <span className="rounded bg-accent px-2 py-1 text-[10px] font-semibold text-white">
                  Marcar hecha
                </span>
              </div>
            </div>
            {/* cuestionario */}
            <div className="mt-2.5 flex items-center justify-between rounded-xl border border-line p-3">
              <span className="text-[12px] font-semibold">GAD-7</span>
              <span className="text-[11px] font-medium text-accent">
                Responder →
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ grid completo --- */

function EverythingGrid() {
  const items = [
    {
      icon: <IconPeople />,
      title: "Pacientes",
      text: "Ficha completa: tareas, notas privadas, etiquetas e historial de la relación terapéutica.",
    },
    {
      icon: <IconChart />,
      title: "Escalas clínicas",
      text: "PHQ-9 y GAD-7 opt-in, con puntuación automática, gráfica de evolución y export CSV.",
    },
    {
      icon: <IconSmile />,
      title: "Diario emocional",
      text: "El paciente registra su ánimo 1-5; tú ves la curva. Sin análisis ni recomendaciones.",
    },
    {
      icon: <IconTicket />,
      title: "Pagos, sin facturas",
      text: "Precios, bonos, deuda y export para tu gestoría. La app nunca emite facturas.",
    },
    {
      icon: <IconFolder />,
      title: "Recursos y documentos",
      text: "Comparte enlaces, PDFs y audios por paciente, con almacenamiento privado en la UE.",
    },
    {
      icon: <IconBars />,
      title: "Analítica de consulta",
      text: "Ocupación, no-shows e ingresos por mes. Descriptiva, anónima, sin interpretación.",
    },
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16">
      <h2 className="max-w-2xl text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
        Reúne todo el acompañamiento
      </h2>
      <p className="mt-3 max-w-xl text-ink-2">
        Deja de saltar entre la agenda, el Excel de pagos, el correo y las
        fotocopias de cuestionarios.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-2xl bg-panel p-6 transition-transform duration-200 hover:-translate-y-1"
          >
            <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-canvas text-ink">
              {it.icon}
            </span>
            <h3 className="mt-4 text-[15px] font-semibold">{it.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{it.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------- testimonios --- */

function Testimonials() {
  const quotes = [
    {
      quote:
        "Todo cambia cuando puedes centralizar la consulta en un solo sitio. Para mí, ese sitio es terap.ia.",
      name: "Dra. Ana Romero",
      org: "Consulta Romero · Madrid",
    },
    {
      quote:
        "Activo el PHQ-9 en dos clics y la evolución se dibuja sola. Antes eran fotocopias y una calculadora.",
      name: "Marc Estruch",
      org: "Gabinet Serra · Barcelona",
    },
    {
      quote:
        "El consumo automático de bonos me ahorra la parte de la consulta que menos me gusta: perseguir pagos.",
      name: "Lucía Herrero",
      org: "Espacio Kora · Valencia",
    },
  ];
  return (
    <section id="testimonios" className="mx-auto w-full max-w-6xl scroll-mt-16 px-5 py-16">
      <h2 className="text-center text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
        Las consultas más cuidadosas confían en nosotros
      </h2>
      <p className="mt-2 text-center text-xs text-ink-3">
        Testimonios ilustrativos del entorno de demostración.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {quotes.map((q) => (
          <figure
            key={q.name}
            className="flex flex-col justify-between rounded-2xl border border-line p-7"
          >
            <DoodleQuote className="w-6 text-ink-3" />
            <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed font-medium">
              {q.quote}
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-panel text-xs font-bold text-ink-2">
                {q.name.charAt(q.name.indexOf(" ") + 1) === "." ? q.name.charAt(0) : q.name.charAt(0)}
              </span>
              <span>
                <span className="block text-sm font-semibold">{q.name}</span>
                <span className="block text-xs text-ink-3">{q.org}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ métricas --- */

function Stats() {
  const stats = [
    { big: "100 %", small: "de los datos alojados en la UE (Fráncfort)" },
    { big: "2", small: "escalas validadas: PHQ-9 y GAD-7, siempre opt-in" },
    { big: "24-48 h", small: "de antelación en los recordatorios de cita" },
    { big: "0", small: "facturas emitidas. Seguimiento sí; facturación no" },
  ];
  return (
    <section id="principios" className="scroll-mt-16 border-y border-line bg-panel">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-16 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.big} className="text-center">
            <p className="text-4xl font-bold tracking-[-0.02em] sm:text-5xl">{s.big}</p>
            <p className="mx-auto mt-2 max-w-[16rem] text-sm text-ink-2">{s.small}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- CTA final --- */

function FinalCTA() {
  return (
    <section className="relative mx-auto w-full max-w-4xl px-5 py-24 text-center">
      <DoodlePlant className="absolute bottom-16 left-2 hidden w-14 text-ink md:block" />
      <DoodleSparkle className="absolute top-16 right-6 hidden w-8 text-ink md:block" />
      <h2 className="text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
        Tu consulta, en calma.
      </h2>
      <p className="mx-auto mt-4 max-w-md text-lg text-ink-2">
        Empieza con tu correo. Sin contraseñas, sin instalación, sin tarjeta.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className={`rounded-md px-6 py-3 text-[15px] font-semibold transition-colors ${BLUE}`}
        >
          Consigue terap.ia gratis
        </Link>
        <Link
          href="/login"
          className="rounded-md bg-panel px-6 py-3 text-[15px] font-semibold text-ink transition-colors hover:bg-wash-2"
        >
          Inicia sesión
        </Link>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- footer --- */

function SiteFooter() {
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: "Producto",
      links: [
        { label: "Panel profesional", href: "#producto" },
        { label: "App del paciente", href: "#paciente" },
        { label: "Escalas clínicas", href: "#producto" },
        { label: "Agenda y citas", href: "#producto" },
        { label: "Seguimiento de pagos", href: "#producto" },
      ],
    },
    {
      title: "Descargar",
      links: [
        { label: "PWA (instalable)", href: "/login" },
        { label: "iOS — próximamente", href: "#" },
        { label: "Android — próximamente", href: "#" },
      ],
    },
    {
      title: "Recursos",
      links: [
        { label: "Cómo funciona", href: "#producto" },
        { label: "Consultas", href: "#testimonios" },
        { label: "Acceso", href: "/login" },
      ],
    },
    {
      title: "Principios",
      links: [
        { label: "Datos en la UE (RGPD)", href: "#principios" },
        { label: "Escalas solo opt-in", href: "#principios" },
        { label: "Sin interpretación clínica", href: "#principios" },
        { label: "Sin emisión de facturas", href: "#principios" },
      ],
    },
  ];
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.2fr_repeat(4,1fr)]">
        <div>
          <Wordmark small />
          <div className="mt-4 flex items-center gap-3 text-ink-3">
            <SocialX />
            <SocialInstagram />
            <SocialLinkedIn />
            <SocialYouTube />
          </div>
          <button
            type="button"
            className="mt-6 inline-flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 text-xs text-ink-2"
          >
            <IconGlobe /> Español (España)
          </button>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 border-t border-line px-5 py-6 text-xs text-ink-3 sm:flex-row">
        <p>© 2026 terap.ia — entorno de demostración con datos ficticios.</p>
        <p>Hecha para la práctica clínica europea.</p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------- iconos --- */
/* Iconos lineales 16px (trazo 1.5, estilo doodle limpio). */

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IconCalendar() {
  return (
    <IconBase>
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </IconBase>
  );
}
function IconSmile() {
  return (
    <IconBase>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M5.5 9.5c.7 1 1.5 1.5 2.5 1.5s1.8-.5 2.5-1.5" />
      <path d="M6 6.2v.01M10 6.2v.01" strokeWidth="2" />
    </IconBase>
  );
}
function IconChart() {
  return (
    <IconBase>
      <path d="M2 13.5h12" />
      <path d="M3.5 10.5 6.5 7l2.5 2 3.5-4.5" />
    </IconBase>
  );
}
function IconCheck() {
  return (
    <IconBase>
      <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.5" />
      <path d="m5.2 8.2 2 2 3.6-4.4" />
    </IconBase>
  );
}
function IconTicket() {
  return (
    <IconBase>
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h9A1.5 1.5 0 0 1 14 5.5v1a1.5 1.5 0 0 0 0 3v1a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 10.5v-1a1.5 1.5 0 0 0 0-3z" />
      <path d="M9.5 4v8" strokeDasharray="1.5 1.8" />
    </IconBase>
  );
}
function IconBell() {
  return (
    <IconBase>
      <path d="M8 2a4 4 0 0 1 4 4c0 3 1 4 1.5 4.5h-11C3 10 4 9 4 6a4 4 0 0 1 4-4z" />
      <path d="M6.8 13a1.3 1.3 0 0 0 2.4 0" />
    </IconBase>
  );
}
function IconPen() {
  return (
    <IconBase>
      <path d="m3 13 .8-3.2 7-7a1.6 1.6 0 0 1 2.3 2.3l-7 7z" />
      <path d="M9.5 4.1 11.9 6.5" />
    </IconBase>
  );
}
function IconAlert() {
  return (
    <IconBase>
      <path d="M8 2.5 14 13H2z" />
      <path d="M8 6.5v3M8 11.4v.01" strokeWidth="1.8" />
    </IconBase>
  );
}
function IconRepeat() {
  return (
    <IconBase>
      <path d="M12.5 6.5A5 5 0 0 0 4 4.5M3.5 9.5A5 5 0 0 0 12 11.5" />
      <path d="M12.5 2.5v4h-4M3.5 13.5v-4h4" />
    </IconBase>
  );
}
function IconPeople() {
  return (
    <IconBase>
      <circle cx="6" cy="5.5" r="2.5" />
      <path d="M2 13.5c.5-2.5 2-3.7 4-3.7s3.5 1.2 4 3.7" />
      <path d="M10.5 3.5a2.5 2.5 0 0 1 0 4M12 10c1.2.5 1.8 1.6 2 3.5" />
    </IconBase>
  );
}
function IconFolder() {
  return (
    <IconBase>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 2h4.5A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z" />
    </IconBase>
  );
}
function IconBars() {
  return (
    <IconBase>
      <path d="M3.5 13V9M8 13V4.5M12.5 13V7" strokeWidth="2" />
    </IconBase>
  );
}
function IconLock() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <IconBase>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c-3.5 3.5-3.5 8.5 0 12M8 2c3.5 3.5 3.5 8.5 0 12" />
    </IconBase>
  );
}

/* -------------------------------------------------------- doodles SVG --- */
/* Ilustraciones de trazo a mano alzada (marca de la casa en notion.com). */

function DoodleSparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M20 4c.8 6.5 3.2 11.4 9.5 12.6-6.3 1.7-8.9 6.3-9.6 13.4-1-7-3.6-11.6-9.9-13.2 6.4-1.3 9-6.2 10-12.8Z" />
      <path d="M33 28c.3 2.4 1.2 4.2 3.5 4.6-2.3.6-3.3 2.3-3.6 5-.4-2.6-1.3-4.3-3.6-4.9 2.3-.5 3.3-2.3 3.7-4.7Z" />
    </svg>
  );
}
function DoodleSquiggle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M3 22c6-9 10-10 12-5s-1 11 4 10 7-9 9-14 6-6 8-1-1 12 4 12 8-6 10-10 6-6 11-3" />
    </svg>
  );
}
function DoodlePlant({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M28 46V22" />
      <path d="M28 30c-8 0-12-4-13-11 8-1 12 3 13 11Z" />
      <path d="M28 24c1-8 5-12 13-12-1 8-5 12-13 12Z" />
      <path d="M17 46h22M20 46c1 4 3 6 8 6s7-2 8-6" />
    </svg>
  );
}
function DoodleQuote({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 4C5.5 5.5 3.5 8 3.5 12a3.8 3.8 0 1 0 3.9-3.8C7.7 6.6 8.4 5.4 9 4Z" />
      <path d="M20 4c-3.5 1.5-5.5 4-5.5 8a3.8 3.8 0 1 0 3.9-3.8c.3-1.6 1-2.8 1.6-4.2Z" />
    </svg>
  );
}

/* -------------------------------------------------------- redes (footer) --- */

function SocialBase({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span aria-label={label} title={label} className="transition-colors hover:text-ink">
      <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden>
        {children}
      </svg>
    </span>
  );
}
function SocialX() {
  return (
    <SocialBase label="X">
      <path d="M11.6 8.7 18 1.5h-1.5l-5.6 6.3-4.4-6.3H1.4l6.7 9.6-6.7 7.6h1.5l5.9-6.7 4.6 6.7h5.1zm-2.1 2.4-.7-1-5.4-7.6h2.3l4.4 6.2.7 1 5.7 8h-2.3z" />
    </SocialBase>
  );
}
function SocialInstagram() {
  return (
    <SocialBase label="Instagram">
      <path d="M10 1.8c2.7 0 3 0 4 .1a5.5 5.5 0 0 1 1.9.3 3.8 3.8 0 0 1 2 2c.2.5.3 1 .3 1.8.1 1.1.1 1.4.1 4.1s0 3-.1 4a5.5 5.5 0 0 1-.3 1.9 3.8 3.8 0 0 1-2 2 5.5 5.5 0 0 1-1.9.3c-1 .1-1.3.1-4 .1s-3 0-4-.1a5.5 5.5 0 0 1-1.9-.3 3.8 3.8 0 0 1-2-2 5.5 5.5 0 0 1-.3-1.9c-.1-1-.1-1.3-.1-4s0-3 .1-4a5.5 5.5 0 0 1 .3-1.9 3.8 3.8 0 0 1 2-2A5.5 5.5 0 0 1 6 1.9c1-.1 1.3-.1 4-.1Zm0 1.6c-2.6 0-2.9 0-4 .1a3.9 3.9 0 0 0-1.4.2 2.2 2.2 0 0 0-1.3 1.3 3.9 3.9 0 0 0-.2 1.4c-.1 1.1-.1 1.4-.1 4s0 2.9.1 4a3.9 3.9 0 0 0 .2 1.4 2.2 2.2 0 0 0 1.3 1.3 3.9 3.9 0 0 0 1.4.2c1.1.1 1.4.1 4 .1s2.9 0 4-.1a3.9 3.9 0 0 0 1.4-.2 2.2 2.2 0 0 0 1.3-1.3 3.9 3.9 0 0 0 .2-1.4c.1-1.1.1-1.4.1-4s0-2.9-.1-4a3.9 3.9 0 0 0-.2-1.4 2.2 2.2 0 0 0-1.3-1.3 3.9 3.9 0 0 0-1.4-.2c-1.1-.1-1.4-.1-4-.1Zm0 2.7a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5-6.7a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0Z" />
    </SocialBase>
  );
}
function SocialLinkedIn() {
  return (
    <SocialBase label="LinkedIn">
      <path d="M17 1.5H3A1.5 1.5 0 0 0 1.5 3v14A1.5 1.5 0 0 0 3 18.5h14a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 17 1.5ZM6.6 15.9H4.1V7.8h2.5ZM5.3 6.7a1.5 1.5 0 1 1 0-2.9 1.5 1.5 0 0 1 0 2.9Zm10.6 9.2h-2.5v-4c0-.9 0-2.1-1.3-2.1s-1.5 1-1.5 2v4.1H8.1V7.8h2.4v1.1a2.7 2.7 0 0 1 2.4-1.3c2.5 0 3 1.7 3 3.8Z" />
    </SocialBase>
  );
}
function SocialYouTube() {
  return (
    <SocialBase label="YouTube">
      <path d="M19.2 5.6a2.4 2.4 0 0 0-1.7-1.7C16 3.5 10 3.5 10 3.5s-6 0-7.5.4a2.4 2.4 0 0 0-1.7 1.7A25.1 25.1 0 0 0 .4 10a25.1 25.1 0 0 0 .4 4.4 2.4 2.4 0 0 0 1.7 1.7c1.5.4 7.5.4 7.5.4s6 0 7.5-.4a2.4 2.4 0 0 0 1.7-1.7A25.1 25.1 0 0 0 19.6 10a25.1 25.1 0 0 0-.4-4.4ZM8.1 12.7V7.3l5 2.7Z" />
    </SocialBase>
  );
}
