import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

/**
 * Correo transaccional.
 *
 * Resend por API HTTP con `fetch`, sin dependencia npm nueva: el proyecto
 * vigila `npm audit --audit-level=low` y una librería más es superficie
 * permanente a cambio de una llamada POST.
 *
 * TRES ESTADOS DISTINTOS, y no se confunden nunca:
 *
 *   · `pending`     — la invitación existe y el envío aún no se ha intentado.
 *   · `sent`        — el PROVEEDOR ha aceptado el mensaje. No es acuse de
 *                     entrega al destinatario, y la interfaz no lo llama así.
 *   · `failed`      — el proveedor lo ha rechazado. Se guarda el motivo.
 *   · `no_provider` — no hay credenciales configuradas en este entorno.
 *
 * Ese último estado es el que hace que esto NO finja envíos. Sin
 * `RESEND_API_KEY` y `EMAIL_FROM` no se manda nada, se deja constancia, y la
 * interfaz enseña el enlace para entregarlo por otra vía.
 */

const API = "https://api.resend.com/emails";

export type ResultadoEnvio =
  | { estado: "sent"; providerId: string | null }
  | { estado: "failed"; error: string }
  | { estado: "no_provider" };

export function proveedorConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

type Mensaje = {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  /** Para el registro: a qué invitación corresponde. Nunca el token. */
  sujeto?: { tipo: string; id: string };
  organizationId?: string | null;
  plantilla: string;
  /** Datos del registro. NUNCA contenido clínico ni el token. */
  payload?: Json;
};

/**
 * Envía y deja constancia en `email_deliveries`.
 *
 * La fila se escribe SIEMPRE, incluso sin proveedor: el profesional tiene que
 * poder ver que la invitación se creó y que el correo no salió.
 */
export async function enviarCorreo(mensaje: Mensaje): Promise<ResultadoEnvio> {
  const admin = createAdminClient();

  const registrar = async (
    status: "sent" | "failed" | "no_provider",
    extra: { provider_id?: string | null; error?: string | null },
  ) => {
    // Un fallo al registrar no puede tumbar la invitación, que es lo que de
    // verdad importa; se anota en consola y se sigue.
    const { error } = await admin.from("email_deliveries").insert({
      to_email: mensaje.para,
      template: mensaje.plantilla,
      subject_type: mensaje.sujeto?.tipo ?? null,
      subject_id: mensaje.sujeto?.id ?? null,
      organization_id: mensaje.organizationId ?? null,
      status,
      attempts: status === "no_provider" ? 0 : 1,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      payload: mensaje.payload ?? {},
      ...extra,
    });
    if (error) console.error("[correo] no se pudo registrar el envío");
  };

  if (!proveedorConfigurado()) {
    await registrar("no_provider", { error: "Sin RESEND_API_KEY o EMAIL_FROM" });
    return { estado: "no_provider" };
  }

  try {
    const respuesta = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [mensaje.para],
        subject: mensaje.asunto,
        html: mensaje.html,
        text: mensaje.texto,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!respuesta.ok) {
      // El cuerpo del error del proveedor puede traer la dirección; se recorta
      // y no se propaga a la interfaz, que solo dice "no se pudo enviar".
      const detalle = (await respuesta.text().catch(() => "")).slice(0, 300);
      await registrar("failed", { error: `HTTP ${respuesta.status}: ${detalle}` });
      return { estado: "failed", error: `El proveedor rechazó el envío (${respuesta.status}).` };
    }

    const cuerpo = (await respuesta.json().catch(() => null)) as { id?: string } | null;
    await registrar("sent", { provider_id: cuerpo?.id ?? null });
    return { estado: "sent", providerId: cuerpo?.id ?? null };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "desconocido";
    await registrar("failed", { error: motivo.slice(0, 300) });
    return { estado: "failed", error: "No se ha podido contactar con el proveedor de correo." };
  }
}
