import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal } from "@/app/_legal/PaginaLegal";

export const metadata: Metadata = { title: "Política de privacidad · Terap" };

/**
 * Política de privacidad (arts. 13 y 14 RGPD). Borrador: ver `PaginaLegal`.
 *
 * Describe cómo funciona HOY la aplicación —qué se guarda, dónde y quién lo
 * ve—. Lo que depende de decisiones aún no tomadas (DPA, base jurídica del
 * art. 9, plazos) va marcado entre corchetes.
 */
export default function PrivacidadPage() {
  return (
    <PaginaLegal titulo="Política de privacidad" actualizado="25 de septiembre de 2026">
      <section>
        <h2>Quién trata tus datos</h2>
        <p className="mt-2">En Terap hay dos papeles distintos, y conviene separarlos:</p>
        <ul>
          <li>
            <strong>Datos de la cuenta y del servicio</strong> (quién se
            registra, cómo contacta, la colegiación del profesional): los trata
            [Titular], NIF [NIF], [domicilio], como <strong>responsable</strong>.
            Contacto: [correo de privacidad]. [Delegado de protección de datos, si
            se designa.]
          </li>
          <li>
            <strong>Datos clínicos de los pacientes</strong> (citas, tareas,
            cuestionarios, diario, documentos, notas): el responsable es{" "}
            <strong>cada profesional o centro</strong>, que decide para qué los
            usa. [Titular] los trata por su cuenta, como{" "}
            <strong>encargado del tratamiento</strong>, solo para prestarle el
            servicio. [Contrato de encargo del tratamiento: pendiente.]
          </li>
        </ul>
      </section>

      <section>
        <h2>Qué datos se tratan</h2>
        <ul>
          <li>
            <strong>Profesionales:</strong> nombre, correo, contraseña (cifrada,
            la gestiona el proveedor de autenticación), colegio y número de
            colegiado, datos de la consulta o del centro, cobros y gastos que
            registra y su configuración fiscal.
          </li>
          <li>
            <strong>Pacientes:</strong> los datos de contacto que anota su
            profesional y, si usa la aplicación, lo que registra en ella: citas,
            tareas, respuestas a cuestionarios, entradas del diario de ánimo y
            los documentos que se le compartan. Muchos son{" "}
            <strong>datos de salud</strong>, una categoría especial (art. 9 RGPD).
          </li>
          <li>
            <strong>Técnicos:</strong> los necesarios para mantener la sesión y,
            si se activan, las suscripciones a notificaciones del dispositivo.
            No hay analítica ni publicidad.
          </li>
        </ul>
      </section>

      <section>
        <h2>Para qué y con qué base</h2>
        <ul>
          <li>
            <strong>Prestar el servicio</strong> a profesionales y pacientes:
            ejecución del contrato (art. 6.1.b RGPD).
          </li>
          <li>
            <strong>Comprobar la colegiación</strong> del profesional, incluida
            la consulta al registro público de su colegio: interés legítimo en
            que solo operen profesionales colegiados (art. 6.1.f).
          </li>
          <li>
            <strong>Datos de salud de los pacientes:</strong> [base jurídica del
            art. 9.2 RGPD pendiente de determinar: asistencia sanitaria bajo
            secreto profesional (9.2.h) y/o consentimiento explícito (9.2.a)]. El
            paciente acepta un consentimiento informado al darse de alta.
          </li>
          <li>
            <strong>Obligaciones legales</strong>, como las de conservación de la
            documentación clínica.
          </li>
        </ul>
      </section>

      <section>
        <h2>Quién más accede</h2>
        <p className="mt-2">
          Nadie ajeno a la relación terapéutica ve datos clínicos: el acceso se
          concede expediente a expediente y lo controla la base de datos. Los
          proveedores que alojan el servicio lo hacen por cuenta de [Titular]:
        </p>
        <ul>
          <li><strong>Supabase</strong>: base de datos, autenticación y archivos, en la Unión Europea (Fráncfort).</li>
          <li><strong>Vercel</strong>: alojamiento de la aplicación web. [Garantías de transferencia internacional, si aplican.]</li>
          <li><strong>Resend</strong>: envío de correos transaccionales, como las invitaciones. [Garantías de transferencia internacional, si aplican.]</li>
        </ul>
        <p className="mt-2">No se venden ni se ceden datos a terceros para otros fines.</p>
      </section>

      <section>
        <h2>Cuánto tiempo se guardan</h2>
        <p className="mt-2">
          Los de la cuenta, mientras esté activa. Los clínicos, el tiempo que
          exija la normativa sanitaria aplicable a la documentación clínica y el
          que decida el profesional como responsable. [Plazos concretos y
          procedimiento de supresión al terminar el servicio: pendientes.]
        </p>
      </section>

      <section>
        <h2>Tus derechos</h2>
        <p className="mt-2">
          Puedes pedir acceso, rectificación, supresión, oposición, limitación
          del tratamiento y portabilidad de tus datos escribiendo a [correo de
          privacidad]. Si eres paciente, los datos clínicos los gestiona tu
          profesional: dirígete a él o a ella, y [Titular] le ayudará a
          atenderte. También puedes reclamar ante la{" "}
          <a
            href="https://www.aepd.es"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Agencia Española de Protección de Datos
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Seguridad</h2>
        <p className="mt-2">
          Conexión cifrada, contraseñas que nunca ve [Titular], aislamiento de
          los datos de cada consulta en la propia base de datos y doble factor
          para la administración de la plataforma.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p className="mt-2">
          Solo las técnicas imprescindibles. Detalle en la{" "}
          <Link href="/cookies" className="text-accent hover:underline">política de cookies</Link>.
        </p>
      </section>
    </PaginaLegal>
  );
}
