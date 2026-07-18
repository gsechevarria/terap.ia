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
    <li className="group flex items-center justify-between px-4 py-3 text-sm">
      <span>
        <span className="text-ink-3">Bloqueo:</span>{" "}
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
        className="btn-danger btn-sm opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        Eliminar
      </button>
    </li>
  );
}
