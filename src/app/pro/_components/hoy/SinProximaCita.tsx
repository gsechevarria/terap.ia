import Link from "next/link";
import type { PacienteSinCita } from "@/lib/queries/hoy";

/** Cuántos se listan antes de mandar al listado completo. */
const TOPE = 5;

/**
 * Pacientes activos sin ninguna cita futura.
 *
 * La maqueta trae además una columna «Frecuencia» y pinta en ámbar a quien
 * supera la frecuencia acordada. Esa frecuencia NO existe en el esquema: no hay
 * columna donde el profesional anote si a un paciente lo ve cada semana o cada
 * mes. Sin ese dato, «hace 19 días» no puede ser ni mucho ni poco, así que la
 * columna se omite y el número va en tinta neutra. Pintarlo de ámbar contra un
 * umbral elegido por el programador sería una alarma inventada.
 *
 * Sin caja: va directamente sobre la hoja, separado por sus líneas.
 */
export function SinProximaCita({ pacientes }: { pacientes: PacienteSinCita[] }) {
  const visibles = pacientes.slice(0, TOPE);

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="section-title">
          Sin próxima cita{" "}
          <span className="font-normal text-ink-4">
            {pacientes.length} {pacientes.length === 1 ? "paciente" : "pacientes"}
          </span>
        </h2>
        {pacientes.length > TOPE && (
          <Link href="/pro/patients" className="text-[13px] text-accent hover:underline">
            Ver los {pacientes.length}
          </Link>
        )}
      </div>

      {pacientes.length === 0 ? (
        <p className="py-3 text-[13.5px] text-ink-3">
          Todos tus pacientes activos tienen su próxima cita agendada.
        </p>
      ) : (
        <table className="w-full text-[13.5px]">
          <thead>
            <tr>
              <th className="border-b border-line py-2 text-left text-[12.5px] font-normal text-ink-3">
                Paciente
              </th>
              <th className="border-b border-line py-2 text-left text-[12.5px] font-normal text-ink-3">
                Última sesión
              </th>
              <th className="border-b border-line py-2 text-right text-[12.5px] font-normal text-ink-3">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id}>
                <td
                  className="py-2.5 font-medium"
                  style={{ borderBottom: "1px solid var(--line-soft)" }}
                >
                  <Link href={`/pro/patients/${p.id}`} className="hover:text-accent">
                    {p.nombre}
                  </Link>
                </td>
                <td
                  className="py-2.5 text-ink-2"
                  style={{ borderBottom: "1px solid var(--line-soft)" }}
                >
                  {p.diasDesde == null
                    ? "Nunca ha acudido"
                    : p.diasDesde === 0
                      ? "hoy"
                      : p.diasDesde === 1
                        ? "ayer"
                        : `hace ${p.diasDesde} días`}
                </td>
                <td
                  className="py-2.5 text-right"
                  style={{ borderBottom: "1px solid var(--line-soft)" }}
                >
                  <Link
                    href={`/pro/agenda?paciente=${p.id}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    Proponer cita
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
