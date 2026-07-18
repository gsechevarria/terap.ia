"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBlockAction } from "@/lib/actions/appointments";
import { formatDateTime } from "@/lib/format";
import type { AgendaBlock } from "@/lib/queries/appointments";

export function BlockItem({ block }: { block: AgendaBlock }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between rounded-lg border border-dashed border-black/[.15] p-3 text-sm dark:border-white/[.15]">
      <span>
        <span className="text-neutral-500">Bloqueo:</span>{" "}
        {formatDateTime(block.starts_at)} → {formatDateTime(block.ends_at)}
        {block.reason ? ` · ${block.reason}` : ""}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteBlockAction(block.id);
            router.refresh();
          })
        }
        className="text-xs text-red-600 underline disabled:opacity-60"
      >
        eliminar
      </button>
    </li>
  );
}
