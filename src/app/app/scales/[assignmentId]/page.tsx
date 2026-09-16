import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
    <>
      <Link href="/app" className="tp-back">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        Inicio
      </Link>

      <ScaleForm
        assignmentId={assignment.id}
        scaleId={assignment.scaleId}
        scaleCode={assignment.scaleCode}
        scaleName={assignment.scaleName}
        definition={assignment.definition}
        emergencyLinks={emergencyLinks}
      />
    </>
  );
}
