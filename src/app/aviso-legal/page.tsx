import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "@/app/_legal/PaginaLegal";

export const metadata: Metadata = { title: "Aviso legal · Terap" };

/** Aviso legal (art. 10 LSSI). Borrador: ver `PaginaLegal`. */
export default function AvisoLegalPage() {
  return (
    <PaginaLegal titulo="Aviso legal" actualizado="25 de septiembre de 2026">
      <section>
        <h2>Titular del sitio</h2>
        <p className="mt-2">
          En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la
          sociedad de la información y de comercio electrónico (LSSI), se
          informa de que este sitio y la aplicación Terap son titularidad de:
        </p>
        <ul>
          <li><strong>Titular:</strong> [Razón social o nombre del titular]</li>
          <li><strong>NIF:</strong> [NIF]</li>
          <li><strong>Domicilio:</strong> [Domicilio social]</li>
          <li><strong>Correo de contacto:</strong> [correo@dominio]</li>
          <li><strong>Datos registrales:</strong> [Registro Mercantil, si procede]</li>
        </ul>
      </section>

      <section>
        <h2>Qué es Terap</h2>
        <p className="mt-2">
          Terap es una herramienta de gestión para profesionales de la
          psicología en consulta privada y para sus pacientes: agenda, citas,
          tareas, cuestionarios que el profesional activa, diario de ánimo,
          seguimiento de cobros y estimaciones fiscales orientativas.
        </p>
        <ul>
          <li>
            <strong>No es un producto sanitario</strong> ni presta atención
            sanitaria: no diagnostica, no interpreta resultados ni recomienda
            tratamientos. Las decisiones clínicas son siempre del profesional.
          </li>
          <li>
            <strong>No es un servicio de urgencias.</strong> Ante una crisis o
            riesgo para la vida, llama al <strong>024</strong> (línea de atención
            a la conducta suicida) o al <strong>112</strong>.
          </li>
          <li>
            <strong>No emite facturas.</strong> Registra cobros y genera
            exportaciones para la gestoría; las cifras fiscales son estimaciones
            orientativas, no declaraciones, y no se presentan ante la AEAT.
          </li>
        </ul>
      </section>

      <section>
        <h2>Condiciones de uso</h2>
        <p className="mt-2">
          El acceso de profesionales exige una cuenta y la comprobación de su
          colegiación, que puede hacerse consultando el registro público del
          colegio profesional correspondiente. El acceso de pacientes solo es
          posible por invitación de su profesional. Cada persona es responsable
          de custodiar sus credenciales y de no introducir datos de terceros sin
          base legal para ello.
        </p>
        <p className="mt-2">
          [Condiciones de contratación, precio, duración y baja del servicio para
          profesionales: pendientes de definir.]
        </p>
      </section>

      <section>
        <h2>Propiedad intelectual</h2>
        <p className="mt-2">
          El diseño, el código y los textos de la aplicación son titularidad de
          [Titular] o se usan con licencia. Los contenidos que suben los
          profesionales y los pacientes siguen siendo suyos.
        </p>
      </section>

      <section>
        <h2>Responsabilidad</h2>
        <p className="mt-2">
          [Titular] procura que el servicio esté disponible y funcione
          correctamente, pero no garantiza la ausencia de interrupciones. No
          responde del uso que cada profesional haga de la información de sus
          pacientes, que trata como responsable del tratamiento.
        </p>
      </section>

      <section>
        <h2>Datos personales y cookies</h2>
        <p className="mt-2">
          El tratamiento de datos personales se explica en la{" "}
          <Link href="/privacidad" className="text-accent hover:underline">política de privacidad</Link>
          , y el uso de cookies y almacenamiento local, en la{" "}
          <Link href="/cookies" className="text-accent hover:underline">política de cookies</Link>.
        </p>
      </section>

      <section>
        <h2>Legislación aplicable</h2>
        <p className="mt-2">
          Este aviso se rige por la legislación española. [Jurisdicción
          competente para los conflictos: pendiente de definir.]
        </p>
      </section>
    </PaginaLegal>
  );
}
