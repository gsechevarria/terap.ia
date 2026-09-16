import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getMyAppointmentsSplit } from "@/lib/queries/appointments";
import { addDaysYMD, formatYMD, parseYMD, todayYMD } from "@/lib/tz";
import { RequestAppointmentForm } from "@/app/app/_components/RequestAppointmentForm";

export const metadata = { title: "Pedir cita · terap.ia" };

export default async function RequestAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ cambiar?: string }>;
}) {
  const sp = await searchParams;
  const target = sp.cambiar;

  // Mover una cita concreta: tiene que ser suya y estar por delante. La RLS ya
  // limita la consulta al paciente actual, y el reparto próximas/pasadas resuelve
  // el "ahora" en la capa de datos (llamarlo durante el render rompe la pureza).
  let currentStart: string | null = null;
  if (target) {
    const { upcoming } = await getMyAppointmentsSplit();
    const appt = upcoming.find((a) => a.id === target);
    if (!appt) notFound();
    currentStart = appt.starts_at;
  }

  // "Mañana" se resuelve aquí (zona española) y viaja como prop: calcularlo en
  // el componente cliente daría otro día en el render de servidor.
  const tomorrow = formatYMD(addDaysYMD(parseYMD(todayYMD()), 1));

  return (
    <>
      <Link href="/app/appointments" className="tp-back">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        Mis citas
      </Link>

      <div className="tp-page-heading">
        <p className="tp-overline">
          {target ? "Cambiar de día" : "Nueva solicitud"}
        </p>
        <div>
          <h1 className="tp-h1">{target ? "Pedir otro día" : "Pedir cita"}</h1>
        </div>
      </div>

      <p className="tp-section-desc" style={{ margin: "0 0 22px" }}>
        Dinos cuándo te vendría bien y tu profesional te responde.
      </p>

      <RequestAppointmentForm
        mode={target ? "reschedule" : "new"}
        appointmentId={target}
        currentStart={currentStart}
        defaultDay={tomorrow}
      />
    </>
  );
}
