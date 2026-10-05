import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppointment } from "@/lib/queries/appointments";
import { getCurrentProfessional } from "@/lib/queries/identity";
import { buildJustificantePdf } from "@/lib/justificante";
import { ymdInTZ } from "@/lib/tz";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

/**
 * Justificante de asistencia de una cita, en PDF, para que el profesional lo
 * firme y se lo entregue al paciente.
 *
 * Solo el profesional que atendió la cita (`getAppointment` filtra por
 * `professional_id`, además de la RLS) y solo si la asistencia está marcada
 * como «acudió»: un justificante de una sesión a la que no se fue sería un
 * documento falso con los datos del profesional.
 *
 * La sesión se comprueba aquí: los route handlers no ejecutan layouts.
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

  const pro = await getCurrentProfessional();
  if (!pro) {
    return new Response("Solo el profesional puede emitir el justificante.", {
      status: 403,
      headers: NO_STORE,
    });
  }

  const { id } = await params;
  const appt = await getAppointment(id);
  if (!appt) {
    return new Response("No encontrado", { status: 404, headers: NO_STORE });
  }
  if (appt.attendance !== "attended") {
    return new Response(
      "Solo se emite justificante de una cita marcada como «acudió».",
      { status: 409, headers: NO_STORE },
    );
  }

  const { data: ficha } = await supabase
    .from("professionals")
    .select("numero_colegiado")
    .eq("id", pro.id)
    .maybeSingle();

  const ahora = new Date();
  const pdf = await buildJustificantePdf({
    profesional: pro.full_name ?? "",
    numeroColegiado: ficha?.numero_colegiado?.trim() || null,
    paciente: appt.patientName ?? "",
    inicioISO: appt.starts_at,
    emitidoISO: ahora.toISOString(),
  });

  // El nombre del fichero no lleva el del paciente: acaba en descargas,
  // adjuntos y servidores de correo.
  const dia = ymdInTZ(new Date(appt.starts_at));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="justificante-asistencia-${dia}.pdf"`,
      ...NO_STORE,
    },
  });
}
