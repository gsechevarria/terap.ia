import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";
import { getUserRole, ROLES } from "@/lib/auth/roles";
import { hasSignedConsent } from "@/lib/queries/consent";

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

  const { data, error } = await supabase.rpc("get_onboarding_consent", { p_token: token });
  if (error || !data) return <main className="mx-auto max-w-2xl p-6">No se puede abrir el consentimiento. Pide a tu profesional un enlace vigente o vuelve a intentarlo.</main>;
  const consent = data as { id: string; title: string; body: string; hash: string; version: number };
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <p className="section-label">Un último paso antes de empezar</p>
      <h1 className="page-title mt-2">{consent.title}</h1>

      <div className="card mt-5 max-h-[50vh] overflow-y-auto bg-panel p-5 text-sm leading-relaxed whitespace-pre-wrap">
        {consent.body}
      </div>

      <p className="mt-2 text-sm">Versión {consent.version}</p>
      <OnboardingForm token={token} templateId={consent.id} contentHash={consent.hash} />
    </main>
  );
}
