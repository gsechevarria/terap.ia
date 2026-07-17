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
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{CONSENT_TITLE}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Un último paso antes de empezar.
      </p>

      <div className="mt-5 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-black/[.08] bg-black/[.02] p-4 text-sm leading-relaxed dark:border-white/[.12] dark:bg-white/[.03]">
        {CONSENT_BODY}
      </div>

      <OnboardingForm token={token} />
    </main>
  );
}
