import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppointment } from "@/lib/queries/appointments";
import { buildICS } from "@/lib/ics";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

/**
 * Descarga .ics de una cita. Solo el profesional dueño o el propio paciente
 * (`getAppointment` filtra por propietario, además de la RLS).
 *
 * La comprobación de sesión va aquí: los route handlers NO ejecutan layouts,
 * así que la guardia de `/pro` y `/app` no les llega. El `.ics` incluye
 * `appt.notes`, que es campo clínico.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("No autorizado", { status: 401, headers: NO_STORE });
  }

  const { id } = await params;
  const appt = await getAppointment(id);
  if (!appt) {
    return new Response("No encontrado", { status: 404, headers: NO_STORE });
  }

  const description =
    [
      appt.notes,
      appt.video_link ? `Videollamada: ${appt.video_link}` : null,
    ]
      .filter(Boolean)
      .join("\n") || null;

  const ics = buildICS({
    uid: appt.id,
    start: appt.starts_at,
    end: appt.ends_at,
    summary: "Sesión de terapia",
    description,
    url: appt.video_link,
    cancelled: appt.status === "cancelled",
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="cita-${appt.id.slice(0, 8)}.ics"`,
      ...NO_STORE,
    },
  });
}
