import { getRequestsForProfessional } from "@/lib/queries/appointment-requests";
import { RequestsPanel } from "@/app/pro/_components/RequestsPanel";

export const metadata = { title: "Solicitudes · terap.ia" };

export default async function SolicitudesPage() {
  const [pending, resolved] = await Promise.all([
    getRequestsForProfessional("pending"),
    getRequestsForProfessional("resolved"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="page-title">Solicitudes</h1>
        <p className="mt-1 text-sm text-ink-2">
          Lo que tus pacientes piden desde su aplicación. Nada entra en tu agenda
          sin que lo aceptes.
        </p>
      </header>

      <RequestsPanel pending={pending} resolved={resolved} />
    </div>
  );
}
