"use client";

import { ErrorState } from "@/components/ErrorState";

export default function PatientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      homeHref="/app"
      homeLabel="Ir al inicio"
    />
  );
}
