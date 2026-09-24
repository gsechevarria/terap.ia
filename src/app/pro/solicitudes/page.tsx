import { getRequestsForProfessional } from "@/lib/queries/appointment-requests";
import { RequestsPanel } from "@/app/pro/_components/RequestsPanel";

export const metadata = { title: "Solicitudes · terap.ia" };

/** «hoy», «ayer», «hace 3 días». */
function haceCuanto(desdeISO: string, ahora: Date): string {
  const dias = Math.floor((ahora.getTime() - new Date(desdeISO).getTime()) / 86_400_000);
  if (dias <= 0) return "de hoy";
  if (dias === 1) return "de ayer";
  return `de hace ${dias} días`;
}

/**
 * Solicitudes de los pacientes, con la cabecera de «Hoy»: título y una frase
 * que dice en una línea cuánto hay por decidir y desde cuándo espera la más
 * antigua, que es lo que se viene a mirar.
 */
export default async function SolicitudesPage() {
  const [pending, resolved] = await Promise.all([
    getRequestsForProfessional("pending"),
    getRequestsForProfessional("resolved"),
  ]);

  // Las pendientes llegan ordenadas de la más antigua a la más reciente.
  const ahora = new Date();
  const masAntigua = pending[0];
  const frase =
    pending.length === 0
      ? "No tienes nada por decidir. Lo que tus pacientes pidan desde su aplicación llegará aquí, y nada entra en tu agenda sin que lo aceptes."
      : `Tienes ${pending.length} ${pending.length === 1 ? "solicitud" : "solicitudes"} por decidir${
          masAntigua ? `; la más antigua es ${haceCuanto(masAntigua.created_at, ahora)}` : ""
        }. Nada entra en tu agenda sin que lo aceptes.`;

  return (
    <div className="flex flex-col gap-[22px]">
      <header>
        <h1 className="page-title">Solicitudes</h1>
        <p className="mt-3 max-w-[600px] text-body-lg text-ink-2">{frase}</p>
      </header>

      <RequestsPanel pending={pending} resolved={resolved} />
    </div>
  );
}
