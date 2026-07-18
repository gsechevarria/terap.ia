import Link from "next/link";
import { redirect } from "next/navigation";
import { getAssignmentForPatient } from "@/lib/queries/scales";
import { getEmergencyLinks } from "@/lib/queries/emergency";
import { ScaleForm } from "@/app/app/_components/ScaleForm";

export default async function PatientScalePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const assignment = await getAssignmentForPatient(assignmentId);
  if (!assignment) redirect("/app");

  const emergencyLinks = await getEmergencyLinks();

  return (
    <div className="mx-auto max-w-md">
      <Link href="/app" className="text-sm text-neutral-500 hover:underline">
        ← Inicio
      </Link>
      <div className="mt-3">
        <ScaleForm
          assignmentId={assignment.id}
          scaleId={assignment.scaleId}
          scaleCode={assignment.scaleCode}
          definition={assignment.definition}
          emergencyLinks={emergencyLinks}
        />
      </div>
    </div>
  );
}
