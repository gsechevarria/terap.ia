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
import { Status, type StatusTone } from "@/components/ui/Status";
import type { InvitacionEquipo, Miembro } from "@/lib/queries/organizations";

const ROL: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Profesional",
};

/** Cómo se presenta la acreditación. `provisional` NUNCA dice "verificado". */
const ACREDITACION: Record<string, { texto: string; tono: StatusTone }> = {
  approved: { texto: "Acreditación verificada", tono: "success" },
  pending: { texto: "Acreditación en revisión", tono: "info" },
  provisional: { texto: "Acreditación sin comprobar", tono: "warn" },
  rejected: { texto: "Acreditación rechazada", tono: "danger" },
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
      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="section-label">
          Equipo ({miembros.length})
        </h2>
        <ul className="card divide-y divide-line">
          {miembros.map((m) => {
            const acred = m.verificacion ? ACREDITACION[m.verificacion] : null;
            const soyYo = m.professionalId === miProfessionalId;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.nombre ?? m.email ?? "Profesional"}
                    {soyYo && <span className="ml-2 text-xs text-ink-3">(tú)</span>}
                  </p>
                  {m.email && <p className="truncate text-xs text-ink-3">{m.email}</p>}
                </div>
                {acred && <Status tone={acred.tono}>{acred.texto}</Status>}
                <span className="chip">{ROL[m.role]}</span>

                {puedeGestionar && !soyYo && (m.role !== "owner" || esPropietario) && (
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <label className="flex items-center gap-1.5 text-xs text-ink-2">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--accent)]"
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
              </li>
            );
          })}
        </ul>
        {puedeGestionar && (
          <p className="text-xs leading-relaxed text-ink-3">
            Retirar a alguien del equipo cierra también sus asignaciones: deja
            de ver los expedientes de este centro inmediatamente. No se borra
            nada de lo que escribió.
          </p>
        )}
      </section>

      {puedeGestionar && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="section-label">Invitar a un profesional</h2>
            <div className="card flex flex-col gap-3 p-4">
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
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={puedeInvitar}
                  onChange={(e) => setPuedeInvitar(e.target.checked)}
                />
                Puede invitar pacientes a Terap
              </label>
              <p className="text-xs leading-relaxed text-ink-3">
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
            </div>

            {ultimo && (
              <div className="card flex flex-col gap-2 p-4 text-sm">
                <p className="flex items-start gap-2">
                  {ultimo.correo === "sent" ? (
                    <>
                      <MailCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} aria-hidden />
                      <span className="text-ink-2">
                        El proveedor ha aceptado el correo para{" "}
                        <strong className="text-ink">{ultimo.destinatario}</strong>.
                        No es acuse de lectura.
                      </span>
                    </>
                  ) : (
                    <>
                      <MailWarning className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} aria-hidden />
                      <span className="text-ink-2">
                        {ultimo.correo === "no_provider"
                          ? "No hay proveedor de correo configurado, así que no se ha enviado nada."
                          : "El correo no ha podido enviarse."}{" "}
                        La invitación sí existe: pásale este enlace.
                      </span>
                    </>
                  )}
                </p>
                <input readOnly value={ultimo.url} className="field text-xs" aria-label="Enlace de invitación" />
                <p className="text-xs text-ink-3">
                  Se muestra una sola vez. Caduca en 48 horas y sirve una vez.
                </p>
              </div>
            )}
          </section>

          {invitaciones.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="section-label">Invitaciones pendientes</h2>
              <ul className="card divide-y divide-line">
                {invitaciones.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm">{i.email}</span>
                    <span className="chip">{ROL[i.role]}</span>
                    <span className="text-xs text-ink-3">
                      Caduca {formatDateTime(i.expiresAt)}
                    </span>
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
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
