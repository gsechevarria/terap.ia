"use client";

import { ErrorState } from "@/components/ErrorState";

export default function ProError({
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
      homeHref="/pro"
      homeLabel="Ir al panel"
    />
  );
}
