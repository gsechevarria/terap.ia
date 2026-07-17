"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeTaskAction } from "@/lib/actions/patient-tasks";
import { formatDate, formatDateTime } from "@/lib/format";
import type { TaskWithCompletion } from "@/lib/queries/tasks";

export function PatientTasks({ tasks }: { tasks: TaskWithCompletion[] }) {
  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Tus tareas</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No tienes tareas pendientes. 🌿
        </p>
      ) : (
        pending.map((t) => <PendingTask key={t.id} task={t} />)
      )}

      {done.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-neutral-500">
            Completadas ({done.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {done.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-black/[.06] p-3 text-sm text-neutral-500 dark:border-white/[.1]"
              >
                <span className="line-through">{t.title}</span>
                {t.lastCompletion && (
                  <span className="ml-2 text-xs text-neutral-400">
                    {formatDateTime(t.lastCompletion.completed_at)}
                  </span>
                )}
                {t.lastCompletion?.response_text && (
                  <p className="mt-1 not-italic">
                    “{t.lastCompletion.response_text}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function isDueSoon(due: string | null): "today" | "overdue" | null {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  if (d < today) return "overdue";
  if (d.getTime() === today.getTime()) return "today";
  return null;
}

function PendingTask({ task }: { task: TaskWithCompletion }) {
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const due = isDueSoon(task.due_date);

  function complete() {
    startTransition(async () => {
      await completeTaskAction(task.id, text);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
      <div className="flex items-center gap-2">
        <span className="font-medium">{task.title}</span>
        {due === "today" && (
          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            para hoy
          </span>
        )}
        {due === "overdue" && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            vencida
          </span>
        )}
      </div>
      {task.description && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
          {task.description}
        </p>
      )}
      {task.due_date && (
        <p className="mt-1 text-xs text-neutral-400">
          Fecha límite: {formatDate(task.due_date)}
        </p>
      )}

      {showText && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Escribe algo si quieres (opcional)…"
          className="mt-3 w-full rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/[.16]"
        />
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={complete}
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "…" : "Marcar hecha"}
        </button>
        {!showText && (
          <button
            type="button"
            onClick={() => setShowText(true)}
            className="text-sm text-neutral-500 underline"
          >
            añadir nota
          </button>
        )}
      </div>
    </div>
  );
}
