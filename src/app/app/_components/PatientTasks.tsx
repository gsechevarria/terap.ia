"use client";
import { callAction } from "@/lib/action-result";

import { useState } from "react";
import { completeTaskAction } from "@/lib/actions/patient-tasks";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { Status } from "@/components/ui/Status";
import type { TaskWithCompletion } from "@/lib/queries/tasks";

/**
 * `today` llega resuelto desde el server component (`todayYMD()` en la zona del
 * profesional). Antes se calculaba con `new Date()` durante el render de este
 * componente cliente, que también se renderiza en servidor: en UTC salía otro
 * día, la etiqueta "vencida"/"para hoy" era incorrecta y rompía la hidratación.
 */
export function PatientTasks({
  tasks,
  today,
}: {
  tasks: TaskWithCompletion[];
  today: string;
}) {
  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Tus tareas</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-ink-2">No tienes tareas pendientes.</p>
      ) : (
        pending.map((t) => (
          <PendingTask key={t.id} task={t} today={today} />
        ))
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

/** Ambas fechas son 'YYYY-MM-DD', así que se comparan como texto. */
function isDueSoon(
  due: string | null,
  today: string,
): "today" | "overdue" | null {
  if (!due) return null;
  if (due < today) return "overdue";
  if (due === today) return "today";
  return null;
}

function PendingTask({
  task,
  today,
}: {
  task: TaskWithCompletion;
  today: string;
}) {
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState("");
  const { run, pending, error } = useAction();
  const due = isDueSoon(task.due_date, today);

  function complete() {
    run(() => callAction(completeTaskAction, task.id, text));
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
          aria-label="Nota sobre la tarea (opcional)"
          className="field mt-3"
        />
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

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
