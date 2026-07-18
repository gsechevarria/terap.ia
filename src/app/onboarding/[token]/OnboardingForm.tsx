"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboardingAction } from "@/lib/actions/onboarding";

export function OnboardingForm({ token }: { token: string }) {
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await completeOnboardingAction(token);
      if (res.ok) {
        router.replace("/app");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--accent)]"
        />
        <span>He leído y acepto el consentimiento informado.</span>
      </label>

      {error && (
        <p className="rounded bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!accepted || pending}
        onClick={submit}
        className="btn-primary h-9 self-start px-5"
      >
        {pending ? "Procesando…" : "Aceptar y continuar"}
      </button>
    </div>
  );
}
