import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { CabeceraLanding } from "./_landing/CabeceraLanding";
import { lora, manrope } from "./_landing/fuentes";
import "./_landing/landing.css";

/**
 * Portada pública. Transcripción fiel de la landing aprobada (versión 3,
 * 15-sep-2026) del paquete `terap-landing`.
 *
 * El texto, la composición y las clases son los del `index.html` entregado; lo
 * único que cambia es lo que no podía quedarse igual:
 *
 *   · Los tres botones que apuntaban a `https://terap.vercel.app` van a
 *     `/login`. Tal como venían, desde el propio dominio devolvían a esta misma
 *     portada: un bucle. `/login` es la única entrada comprobada a la
 *     aplicación; no hay ruta de registro porque el alta de profesionales dejó
 *     de ser autoservicio en agosto.
 *   · El año del pie lo calcula el servidor. La entrega lo escribía por
 *     JavaScript sobre un `2026` fijo, y aquí no hace falta.
 *   · Las imágenes se sirven desde `/landing-terap/` con `<img>` normal y no
 *     con `next/image`: el optimizador reescribe el fichero, y la entrega pide
 *     expresamente conservar la captura sin conversión con pérdida.
 *
 * El CSS vive aislado en `_landing/landing.css`; el porqué está en la cabecera
 * de ese fichero y en `scripts/adaptar-landing.mjs`.
 */
export const metadata: Metadata = {
  title: "Terap — La terapia continúa entre sesiones",
  description:
    "Terap reúne tu consulta de psicología y el seguimiento del paciente entre sesiones. Descubre una forma más conectada de acompañar.",
};

export const viewport: Viewport = {
  // Color de la entrega aprobada, solo para la portada. El resto de la
  // aplicación conserva el suyo desde el layout raíz.
  themeColor: "#172c38",
  width: "device-width",
  initialScale: 1,
};

export default function Home() {
  return (
    <div className={`lp-terap ${manrope.variable} ${lora.variable}`}>
      <CabeceraLanding />

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="mini-mark">✳</span> EL ESPACIO DE TU CONSULTA
            </div>
            <h1>
              La terapia
              <br />
              continúa{" "}
              <em>
                entre
                <br />
                sesiones.
              </em>
            </h1>
            <p>
              Tu consulta organizada. Tus pacientes, más cerca.
              <br className="desktop" /> El CRM para psicólogos que conecta la
              gestión del día a día con lo que ocurre entre una sesión y la
              siguiente.
            </p>
            <div className="actions">
              <a href="#plataforma" className="button primary">
                Descubre Terap <span>↗</span>
              </a>
              <a href="#seguimiento" className="text-link">
                Así funciona <span>↓</span>
              </a>
            </div>
            <div className="hero-note">
              <span>Diseñado alrededor de lo que importa.</span>
              <strong>Las personas.</strong>
            </div>
          </div>
          <div className="hero-visual">
            <img
              className="hero-photo"
              src="/landing-terap/profesional.jpg"
              alt="Profesional sonriente en un entorno de conversación cercano"
            />
            <div className="image-top">
              MÁS ALLÁ DE LA CONSULTA <span>↗</span>
            </div>
            <div className="floating-card">
              <span className="card-symbol">✳</span>
              <div>
                <span className="meta">UN HILO ENTRE SESIONES</span>
                <strong>Cada pequeño paso cuenta.</strong>
                <span>Un espacio para seguir acompañando.</span>
              </div>
            </div>
            <div className="image-caption">Tecnología al servicio del vínculo.</div>
          </div>
        </section>

        <div className="principles wrap">
          <span>
            MENOS FRICCIÓN.
            <br />
            <strong>Más espacio para acompañar.</strong>
          </span>
          <a href="#gestion">
            <span className="principle-number">01</span>
            <strong>
              Organiza
              <br />
              tu consulta
            </strong>
            <span className="principle-detail">Pacientes, agenda y gestión</span>
          </a>
          <a href="#seguimiento">
            <span className="principle-number">02</span>
            <strong>
              Conecta
              <br />
              cada sesión
            </strong>
            <span className="principle-detail">Seguimiento y tareas pendientes</span>
          </a>
          <a href="#plataforma">
            <span className="principle-number">03</span>
            <strong>
              Mantén
              <br />
              el contexto
            </strong>
            <span className="principle-detail">Una visión de cada paciente</span>
          </a>
        </div>

        <section id="plataforma" className="platform section wrap">
          <div className="section-heading">
            <div>
              <div className="eyebrow">01 / TU CONSULTA, EN PERSPECTIVA</div>
              <h2>
                Todo conectado.
                <br />
                <em>Tú, en lo importante.</em>
              </h2>
            </div>
            <p>
              Pacientes, agenda, tareas, pagos y seguimiento. Descubre todo lo que
              puedes tener a mano en tu consulta.
            </p>
          </div>
          <div className="real-product">
            <div className="screen-header">
              <span>TERAP / TU ESPACIO DE TRABAJO</span>
              <a href="/landing-terap/interfaz.png" target="_blank" rel="noopener">
                Ver a tamaño completo ↗
              </a>
            </div>
            {/* Captura del panel real, sin recortar ni recomprimir. No es la
                del paquete de entrega: aquella mostraba el correo personal de
                la sesión, legible, y esto es una página pública. Esta se hizo
                con la cuenta de demostración y no enseña ninguna cuenta.
                Las medidas son las suyas de verdad, para que el hueco quede
                reservado y la composición no salte al cargar. */}
            <img
              src="/landing-terap/interfaz.png"
              alt="Interfaz original de Terap: pacientes, expedientes en seguimiento, etiquetas, tareas pendientes, próxima cita y última actividad"
              loading="lazy"
              width={1685}
              height={927}
            />
            <div className="screen-caption">
              <span>Así es Terap por dentro.</span>
              <span>Tu consulta, en una sola vista.</span>
            </div>
          </div>
          <div id="gestion" className="management-grid">
            <article>
              <span className="feature-kicker">01 / PACIENTES</span>
              <h3>
                Cada historia,
                <br />
                en su lugar.
              </h3>
              <p>
                Encuentra a tus pacientes por nombre, correo o teléfono. Organiza
                los expedientes con etiquetas y distingue los activos de los
                archivados.
              </p>
              <div className="feature-tags">
                <span>Expedientes</span>
                <span>Etiquetas</span>
                <span>Búsqueda</span>
              </div>
            </article>
            <article>
              <span className="feature-kicker">02 / AGENDA Y SEGUIMIENTO</span>
              <h3>
                Una visión clara
                <br />
                del próximo paso.
              </h3>
              <p>
                Consulta las próximas citas, las tareas pendientes y la última
                actividad de cada paciente. Mantén a la vista lo que necesita
                atención.
              </p>
              <div className="feature-tags">
                <span>Agenda</span>
                <span>Tareas</span>
                <span>Actividad</span>
              </div>
            </article>
            <article>
              <span className="feature-kicker">03 / GESTIÓN DE LA CONSULTA</span>
              <h3>
                Más que
                <br />
                una agenda.
              </h3>
              <p>
                Accede a solicitudes, pagos, contabilidad y analítica desde el
                mismo espacio de trabajo. La gestión forma parte de tu consulta.
              </p>
              <div className="feature-tags">
                <span>Pagos</span>
                <span>Contabilidad</span>
                <span>Analítica</span>
              </div>
            </article>
          </div>
        </section>

        <section id="seguimiento" className="continuity">
          <div className="wrap continuity-grid">
            <div className="continuity-image">
              <img
                src="/landing-terap/bienestar.jpg"
                alt="Personas disfrutando juntas de un momento de bienestar al aire libre"
                loading="lazy"
              />
              <div className="photo-label">EL PROCESO NO SE DETIENE AL SALIR.</div>
            </div>
            <div className="continuity-copy">
              <div className="eyebrow">02 / EL VALOR DE LA CONTINUIDAD</div>
              <h2>
                Entre un «nos vemos»
                <br />y un «¿cómo estás?»
                <br />
                <em>pasan muchas cosas.</em>
              </h2>
              <p>
                La vida ocurre fuera de la consulta. Terap incorpora el seguimiento
                entre sesiones para que ese tiempo también tenga un lugar en el
                proceso.
              </p>
              <div className="steps">
                <div>
                  <span>01</span>
                  <p>
                    <strong>Un punto de partida compartido</strong>La sesión forma
                    parte de un proceso que continúa.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <p>
                    <strong>Espacio para el día a día</strong>El seguimiento conecta
                    con lo que sucede fuera de consulta.
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <p>
                    <strong>Contexto para el próximo encuentro</strong>Retoma el
                    hilo del acompañamiento con perspectiva.
                  </p>
                </div>
              </div>
              <a className="text-link light" href="#experiencia">
                Explora la experiencia <span>↗</span>
              </a>
            </div>
          </div>
        </section>

        <section id="experiencia" className="section wrap experience">
          <div className="eyebrow">03 / TECNOLOGÍA CON SENTIDO</div>
          <h2>
            Una consulta más organizada.
            <br />
            <em>Un acompañamiento más conectado.</em>
          </h2>
          <div className="people-story">
            <img
              src="/landing-terap/conexion.jpg"
              alt="Una conversación cercana entre personas sonrientes"
              loading="lazy"
            />
            <div>
              <span className="eyebrow">DETRÁS DE CADA EXPEDIENTE, UNA PERSONA</span>
              <h3>
                La gestión se organiza.
                <br />
                <em>El vínculo se cuida.</em>
              </h3>
              <p>
                Más espacio para escuchar, compartir y acompañar. Terap conecta la
                organización de tu consulta con la continuidad del proceso.
              </p>
            </div>
          </div>
          <div className="benefit-grid">
            <article>
              <span className="benefit-icon">▦</span>
              <h3>Menos dispersión</h3>
              <p>
                La gestión de tu consulta y el seguimiento del paciente en una misma
                plataforma.
              </p>
            </article>
            <article>
              <span className="benefit-icon">⌁</span>
              <h3>Más continuidad</h3>
              <p>
                Una visión del proceso que va más allá de los encuentros en
                consulta.
              </p>
            </article>
            <article>
              <span className="benefit-icon">✳</span>
              <h3>El vínculo, en el centro</h3>
              <p>
                Una herramienta para apoyar tu trabajo y tu criterio como
                profesional.
              </p>
            </article>
          </div>
        </section>

        <section id="preguntas" className="faq section wrap">
          <div>
            <div className="eyebrow">RESOLVEMOS TUS DUDAS</div>
            <h2>
              Lo esencial,
              <br />
              <em>con claridad.</em>
            </h2>
          </div>
          <div className="questions">
            <details open>
              <summary>
                ¿Qué es Terap?<span>+</span>
              </summary>
              <p>
                Terap es una aplicación de CRM para psicólogos que combina la
                gestión de la consulta con el seguimiento del paciente entre
                sesiones.
              </p>
            </details>
            <details>
              <summary>
                ¿Qué hace diferente a Terap?<span>+</span>
              </summary>
              <p>
                Su enfoque reúne dos partes del trabajo: la organización de la
                consulta y la continuidad del acompañamiento fuera de las sesiones.
              </p>
            </details>
            <details>
              <summary>
                ¿Sustituye las sesiones de terapia?<span>+</span>
              </summary>
              <p>
                No. Es una herramienta de apoyo a la gestión y al seguimiento. El
                vínculo terapéutico y el criterio del profesional siguen siendo el
                centro del proceso.
              </p>
            </details>
            <details>
              <summary>
                ¿Dónde puedo acceder a la aplicación?<span>+</span>
              </summary>
              <p>
                Puedes visitar la web actual desde{" "}
                <Link href="/login">Acceder a Terap</Link> para consultar las
                opciones disponibles.
              </p>
            </details>
          </div>
        </section>

        <section className="closing wrap">
          <span className="mini-mark">✳</span>
          <div className="eyebrow">TU CONSULTA. SU PROCESO. UN MISMO ESPACIO.</div>
          <h2>
            El siguiente paso
            <br />
            es <em>estar más cerca.</em>
          </h2>
          <Link className="button primary" href="/login">
            Ir a Terap <span>↗</span>
          </Link>
        </section>
      </main>

      <footer className="wrap">
        <a className="brand" href="#">
          <span className="mark">t</span>terap.
        </a>
        <p>El espacio que conecta tu consulta.</p>
        <span>© {new Date().getFullYear()} Terap</span>
        <a href="#">Volver arriba ↑</a>
      </footer>
    </div>
  );
}
