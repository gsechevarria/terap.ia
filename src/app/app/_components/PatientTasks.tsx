"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeTaskAction } from "@/lib/actions/patient-tasks";
import { formatDate, formatDateTime } from "@/lib/format";
import { Status } from "@/components/ui/Status";
import type { TaskWithCompletion } from "@/lib/queries/tasks";

export function PatientTasks({ tasks }: { tasks: TaskWithCompletion[] }) {
  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Tus tareas</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-ink-2">No tienes tareas pendientes.</p>
      ) : (
        pending.map((t) => <PendingTask key={t.id} task={t} />)
      )}

      {done.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm text-ink-3 hover:text-ink">
            Completadas ({done.length})
          </summary>
          <ul className="card mt-2 divide-y divide-line">
            {done.map((t) => (
              <li key={t.id} className="px-4 py-3 text-sm text-ink-2">
                <span className="line-through">{t.title}</span>
                {t.lastCompletion && (
                  <span className="ml-2 text-xs text-ink-3">
                    {formatDateTime(t.lastCompletion.completed_at)}
                  </span>
                )}
                {t.lastCompletion?.response_text && (
                  <p className="mt-1">“{t.lastCompletion.response_text}”</p>
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
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{task.title}</span>
        {due === "today" && <Status tone="info">para hoy</Status>}
        {due === "overdue" && (
          <Status tone="warn" halo>
            vencida
          </Status>
        )}
      </div>
      {task.description && (
        <p className="mt-1 text-sm whitespace-pre-wrap text-ink-2">
          {task.description}
        </p>
      )}
      {task.due_date && (
        <p className="mt-1 text-xs text-ink-3">
          Fecha límite: {formatDate(task.due_date)}
        </p>
      )}

      {showText && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Escribe algo si quieres (opcional)…"
          className="field mt-3"
        />
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={complete}
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "…" : "Marcar hecha"}
        </button>
        {!showText && (
          <button
            type="button"
            onClick={() => setShowText(true)}
            className="btn-subtle"
          >
            Añadir nota
          </button>
        )}
      </div>
    </div>
  );
}
