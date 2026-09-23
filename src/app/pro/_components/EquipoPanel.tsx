"use client";

import { useState } from "react";
import { Ban, MailCheck, MailWarning, UserPlus } from "lucide-react";
import { callAction } from "@/lib/action-result";
import { useAction } from "@/lib/use-action";
import {
  cambiarPermisosMiembroAction,
  invitarProfesionalAction,
  revocarInvitacionProfesionalAction,
  revocarMiembroAction,
} from "@/lib/actions/organizations";
import { formatDateTime } from "@/lib/format";
import type { InvitacionEquipo, Miembro } from "@/lib/queries/organizations";

const ROL: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Profesional",
};

/**
 * Cómo se presenta la acreditación. `provisional` NUNCA dice "verificado":
 * opera, pero su colegiación no se ha comprobado, y son cosas distintas.
 *
 * El color va en el texto, no en una pastilla, y no es el único portador: la
 * frase dice el estado entero, así que quien no distinga el ámbar del verde lee
 * exactamente lo mismo.
 */
const ACREDITACION: Record<string, { texto: string; clase: string }> = {
  approved: { texto: "Acreditación verificada", clase: "text-success" },
  pending: { texto: "Acreditación en revisión", clase: "text-info" },
  provisional: { texto: "Acreditación sin comprobar", clase: "text-warning-ink" },
  rejected: { texto: "Acreditación rechazada", clase: "text-danger" },
};

export function EquipoPanel({
  organizationId,
  miembros,
  invitaciones,
  puedeGestionar,
  esPropietario,
  miProfessionalId,
}: {
  organizationId: string;
  miembros: Miembro[];
  invitaciones: InvitacionEquipo[];
  puedeGestionar: boolean;
  esPropietario: boolean;
  miProfessionalId: string | null;
}) {
  const { run, pending, error } = useAction();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"admin" | "member">("member");
  const [puedeInvitar, setPuedeInvitar] = useState(true);
  const [ultimo, setUltimo] = useState<{ url: string; correo: string; destinatario: string } | null>(null);

  function invitar() {
    run(async () => {
      const r = await callAction(
        invitarProfesionalAction,
        organizationId,
        email,
        rol,
        puedeInvitar,
      );
      setUltimo({ url: r.url, correo: r.correo, destinatario: r.destinatario });
      setEmail("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-[13.5px] text-danger">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="section-title">
          Equipo{" "}
          <span className="font-normal text-ink-4">
            {miembros.length} {miembros.length === 1 ? "persona" : "personas"}
          </span>
        </h2>

        <div className="table-wrap">
          <table className="table-base">
            <thead>
              <tr>
                <th>Profesional</th>
                <th>Acreditación</th>
                <th>Permisos</th>
                {puedeGestionar && (
                  <th className="text-right">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {miembros.map((m) => {
                const acred = m.verificacion ? ACREDITACION[m.verificacion] : null;
                const soyYo = m.professionalId === miProfessionalId;
                // Al propietario solo lo toca otro propietario, y nadie se
                // retira a sí mismo desde aquí.
                const gestionable =
                  puedeGestionar && !soyYo && (m.role !== "owner" || esPropietario);
                return (
                  <tr key={m.id}>
                    <td>
                      <p className="font-medium">
                        {m.nombre ?? m.email ?? "Profesional"}
                        {soyYo && (
                          <span className="ml-2 font-normal text-ink-3">(tú)</span>
                        )}
                      </p>
                      {m.email && (
                        <p className="truncate text-[12.5px] text-ink-3">{m.email}</p>
                      )}
                    </td>
                    <td>
                      {acred && (
                        <span className={`font-medium ${acred.clase}`}>
                          {acred.texto}
                        </span>
                      )}
                    </td>
                    <td className="text-ink-2">{ROL[m.role]}</td>
                    {puedeGestionar && (
                      <td className="text-right">
                        {gestionable && (
                          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                            <label className="flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-ink-2">
                              <input
                                type="checkbox"
                                className="size-4 accent-[var(--accent)]"
                                checked={m.canInvitePatients}
                                disabled={pending}
                                onChange={(e) =>
                                  run(() =>
                                    callAction(
                                      cambiarPermisosMiembroAction,
                                      m.id,
                                      m.role,
                                      e.target.checked,
                                    ),
                                  )
                                }
                              />
                              Puede invitar pacientes
                            </label>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(() => callAction(revocarMiembroAction, m.id))}
                              className="btn-danger btn-sm"
                            >
                              Retirar del equipo
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {puedeGestionar && (
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Retirar a alguien del equipo cierra también sus asignaciones: deja
            de ver los expedientes de este centro inmediatamente. No se borra
            nada de lo que escribió.
          </p>
        )}
      </section>

      {puedeGestionar && (
        <>
          {/* Las zonas se separan con una línea y aire, no metiendo el
              formulario en otra caja dentro de la hoja. */}
          <section className="flex flex-col gap-3.5 border-t border-line pt-6">
            <h2 className="section-title">Invitar a un profesional</h2>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="min-w-0 flex-1">
                <label className="field-label" htmlFor="equipo-email">
                  Correo
                </label>
                <input
                  id="equipo-email"
                  type="email"
                  className="field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colega@centro.com"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="equipo-rol">
                  Permisos
                </label>
                <select
                  id="equipo-rol"
                  className="field"
                  value={rol}
                  onChange={(e) => setRol(e.target.value as "admin" | "member")}
                >
                  <option value="member">Profesional</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={puedeInvitar}
                onChange={(e) => setPuedeInvitar(e.target.checked)}
              />
              Puede invitar pacientes a Terap
            </label>

            <p className="max-w-prose text-[12.5px] leading-relaxed text-ink-3">
              Un administrador gestiona el centro y el equipo. La propiedad no
              se reparte desde aquí. Quien ya tenga su acreditación aprobada no
              vuelve a pasar por revisión por unirse a este centro.
            </p>

            <button
              type="button"
              onClick={invitar}
              disabled={pending || !email.trim()}
              className="btn-primary self-start"
            >
              <UserPlus className="size-4" strokeWidth={2} aria-hidden />
              {pending ? "Enviando…" : "Enviar invitación"}
            </button>

            {ultimo && (
              <div className="tinted flex flex-col gap-2.5 p-4 text-[13.5px]">
                <p className="flex items-start gap-2">
                  {ultimo.correo === "sent" ? (
                    <>
                      <MailCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} aria-hidden />
                      <span className="text-ink-2">
                        El proveedor ha aceptado el correo para{" "}
                        <strong className="font-semibold text-ink">{ultimo.destinatario}</strong>.
                        No es acuse de lectura.
                      </span>
                    </>
                  ) : (
                    <>
                      <MailWarning className="mt-0.5 size-4 shrink-0 text-warning-ink" strokeWidth={2} aria-hidden />
                      <span className="text-ink-2">
                        {ultimo.correo === "no_provider"
                          ? "No hay proveedor de correo configurado, así que no se ha enviado nada."
                          : "El correo no ha podido enviarse."}{" "}
                        La invitación sí existe: pásale este enlace.
                      </span>
                    </>
                  )}
                </p>
                <input readOnly value={ultimo.url} className="field" aria-label="Enlace de invitación" />
                <p className="text-[12.5px] text-ink-3">
                  Se muestra una sola vez. Caduca en 48 horas y sirve una vez.
                </p>
              </div>
            )}
          </section>

          {invitaciones.length > 0 && (
            <section className="flex flex-col gap-3 border-t border-line pt-6">
              <h2 className="section-title">Invitaciones pendientes</h2>
              <div className="table-wrap">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Correo</th>
                      <th>Permisos</th>
                      <th>Caduca</th>
                      <th className="text-right">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitaciones.map((i) => (
                      <tr key={i.id}>
                        <td className="font-medium">{i.email}</td>
                        <td className="text-ink-2">{ROL[i.role]}</td>
                        <td className="text-ink-2">{formatDateTime(i.expiresAt)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() => callAction(revocarInvitacionProfesionalAction, i.id))
                            }
                            className="btn-danger btn-sm"
                          >
                            <Ban className="size-3.5" strokeWidth={2} aria-hidden />
                            Revocar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
