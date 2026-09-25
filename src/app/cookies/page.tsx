import type { Metadata } from "next";
import { PaginaLegal } from "@/app/_legal/PaginaLegal";

export const metadata: Metadata = { title: "Política de cookies · terap.ia" };

/**
 * Política de cookies. Borrador: ver `PaginaLegal`.
 *
 * Lista lo que la aplicación guarda HOY en el navegador (comprobado en el
 * código el 25-sep-2026): la sesión de Supabase, la preferencia de aspecto y la
 * caché del service worker. Todo es técnico y necesario, así que no hace falta
 * banner de consentimiento. Si algún día se añade analítica o Sentry se activa
 * con algo que guarde en el navegador, esta página y el banner van primero.
 */
export default function CookiesPage() {
  return (
    <PaginaLegal titulo="Política de cookies" actualizado="25 de septiembre de 2026">
      <section>
        <h2>Resumen</h2>
        <p className="mt-2">
          terap.ia <strong>solo usa cookies y almacenamiento técnicos</strong>,
          imprescindibles para que funcione. No hay cookies de analítica, de
          publicidad ni de terceros, así que no se pide consentimiento para
          ellas (art. 22.2 LSSI).
        </p>
      </section>

      <section>
        <h2>Qué se guarda en tu navegador</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table-base table-plain">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Para qué</th>
                <th scope="col">Duración</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="whitespace-nowrap">sb-…-auth-token</td>
                <td>Cookie propia, técnica</td>
                <td>Mantener la sesión iniciada. Sin ella no se puede entrar.</td>
                <td>Mientras dure la sesión</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap">terapia:aspecto</td>
                <td>Almacenamiento local</td>
                <td>Recordar si prefieres el aspecto claro u oscuro.</td>
                <td>Hasta que lo borres</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap">terapia-shell-v1</td>
                <td>Caché del navegador</td>
                <td>
                  Guardar los archivos estáticos de la aplicación (iconos, página
                  sin conexión) para que cargue más rápido. No guarda datos
                  personales ni clínicos.
                </td>
                <td>Hasta la siguiente versión</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Cómo borrarlas</h2>
        <p className="mt-2">
          Puedes borrarlas desde la configuración de tu navegador. Si borras la
          cookie de sesión tendrás que volver a iniciar sesión; el resto solo
          hace que la aplicación olvide tu preferencia de aspecto o tarde un poco
          más en cargar.
        </p>
      </section>

      <section>
        <h2>Contacto</h2>
        <p className="mt-2">Para cualquier duda: [correo de contacto].</p>
      </section>
    </PaginaLegal>
  );
}
