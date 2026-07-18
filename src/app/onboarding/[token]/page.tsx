import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";
import { getUserRole, ROLES } from "@/lib/auth/roles";
import { hasSignedConsent } from "@/lib/queries/consent";
import { CONSENT_BODY, CONSENT_TITLE } from "@/lib/consent";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?invite=${token}`);

  if (getUserRole(user) === ROLES.PROFESSIONAL) redirect("/pro");

  const patient = await getCurrentPatient();
  if (patient && (await hasSignedConsent(patient.id))) redirect("/app");

  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <p className="section-label">Un último paso antes de empezar</p>
      <h1 className="page-title mt-2">{CONSENT_TITLE}</h1>

      <div className="card mt-5 max-h-[50vh] overflow-y-auto bg-panel p-5 text-sm leading-relaxed whitespace-pre-wrap">
        {CONSENT_BODY}
      </div>

      <OnboardingForm token={token} />
    </main>
  );
}
