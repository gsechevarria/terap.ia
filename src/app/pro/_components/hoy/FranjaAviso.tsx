import Link from "next/link";
import type { AvisoSeguridad } from "@/lib/queries/hoy";
import type { EmergencyLink } from "@/lib/queries/emergency";
import { formatTime } from "@/lib/format";

function antiguedad(desdeISO: string, ahoraISO: string): string {
  const minutos = Math.max(
    0,
    Math.round((new Date(ahoraISO).getTime() - new Date(desdeISO).getTime()) / 60000),
  );
  if (minutos < 60) return minutos <= 1 ? "hace un momento" : `hace ${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return horas === 1 ? "hace una hora" : `hace ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

/**
 * Franja de aviso de seguridad. Franja y no tarjeta: cruza la hoja entera y va
 * inmediatamente debajo del saludo, antes que cualquier otra cosa.
 *
 * Describe lo que el paciente respondió y NO lo interpreta: se cita el enunciado
 * del ítem y la opción que marcó, literales, tal y como están en el catálogo de
 * la escala. No hay severidad, ni puntuación, ni ninguna frase sobre qué
 * significa. Esa lectura es del profesional.
 *
 * Las dos acciones son las del protocolo: los recursos de emergencia
 * configurados (`emergency_links`, que ya incluyen el 024) y el acceso directo
 * a la respuesta para darla por revisada.
 */
export function FranjaAviso({
  avisos,
  recursos,
  ahoraISO,
}: {
  avisos: AvisoSeguridad[];
  recursos: EmergencyLink[];
  ahoraISO: string;
}) {
  const principal = avisos[0];
  if (!principal) return null;
  const restantes = avisos.length - 1;
  const emergencia = recursos.find((r) => r.phone) ?? recursos[0] ?? null;

  return (
    <section className="alert-clinical" aria-labelledby="aviso-seguridad">
      <span
        aria-hidden
        className="mt-[5px] block size-2 shrink-0 rounded-full"
        style={{
          background: "var(--danger)",
          boxShadow: "0 0 0 3px color-mix(in srgb, var(--danger) 20%, transparent)",
        }}
      />
      <div className="min-w-0 flex-1">
        <h2 id="aviso-seguridad" className="font-semibold" style={{ color: "var(--danger-ink)" }}>
          {principal.paciente} marcó el ítem de riesgo del {principal.escala}
          {restantes > 0 && (
            <span className="font-normal text-ink-2"> y {restantes} más sin revisar</span>
          )}
        </h2>

        {principal.pregunta && (
          <p className="mt-1.5 text-ink-2">
            <span className="text-ink-3">{principal.pregunta}</span>
            {principal.respuesta && (
              <>
                {" "}
                Respondió: <strong className="font-semibold text-ink">{principal.respuesta}</strong>.
              </>
            )}
          </p>
        )}

        <p className="mt-1 text-[12.5px] text-ink-3">
          {antiguedad(principal.submittedAt, ahoraISO)}
          {principal.citaHoy && (
            <>
              . Tiene sesión hoy a las{" "}
              <strong className="font-semibold text-ink-2">
                {formatTime(principal.citaHoy)}
              </strong>
            </>
          )}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <Link
            href={`/pro/patients/${principal.patientId}?tab=escalas`}
            className="font-semibold text-accent hover:underline"
          >
            Revisar ahora
          </Link>
          {emergencia?.phone && (
            <a
              href={`tel:${emergencia.phone}`}
              className="font-semibold text-accent hover:underline"
            >
              {emergencia.label}, {emergencia.phone}
            </a>
          )}
          {recursos.length > 1 && (
            <span className="text-ink-3">
              {recursos.length} recursos de emergencia configurados
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
