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
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>He leído y acepto el consentimiento informado.</span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!accepted || pending}
        onClick={submit}
        className="self-start rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Procesando…" : "Aceptar y continuar"}
      </button>
    </div>
  );
}
