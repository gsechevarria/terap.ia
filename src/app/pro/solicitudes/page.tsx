import { getRequestsForProfessional } from "@/lib/queries/appointment-requests";
import { RequestsPanel } from "@/app/pro/_components/RequestsPanel";

export const metadata = { title: "Solicitudes · terap.ia" };

export default async function SolicitudesPage() {
  const [pending, resolved] = await Promise.all([
    getRequestsForProfessional("pending"),
    getRequestsForProfessional("resolved"),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7">
      <header>
        <h1 className="page-title">Solicitudes</h1>
        <p className="mt-3 max-w-[520px] text-body-lg text-ink-2">
          Lo que tus pacientes piden desde su aplicación. Nada entra en tu agenda
          sin que lo aceptes.
        </p>
      </header>

      <RequestsPanel pending={pending} resolved={resolved} />
    </div>
  );
}
