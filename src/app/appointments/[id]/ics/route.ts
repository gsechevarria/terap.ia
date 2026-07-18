import { type NextRequest } from "next/server";
import { getAppointment } from "@/lib/queries/appointments";
import { buildICS } from "@/lib/ics";

/** Descarga .ics de una cita. RLS: solo el profesional dueño o el paciente. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const appt = await getAppointment(id);
  if (!appt) return new Response("No encontrado", { status: 404 });

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
    },
  });
}
