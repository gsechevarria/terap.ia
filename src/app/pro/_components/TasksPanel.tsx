"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "@/lib/actions/tasks";
import { formatDate, formatDateTime } from "@/lib/format";
import type { TaskWithCompletion } from "@/lib/queries/tasks";

type Draft = { title: string; description: string; dueDate: string };

const EMPTY: Draft = { title: "", description: "", dueDate: "" };

export function TasksPanel({
  patientId,
  tasks,
}: {
  patientId: string;
  tasks: TaskWithCompletion[];
}) {
  const [creating, setCreating] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function create() {
    if (!creating.title.trim()) return;
    startTransition(async () => {
      await createTaskAction({
        patientId,
        title: creating.title,
        description: creating.description,
        dueDate: creating.dueDate || null,
      });
      setCreating(EMPTY);
      router.refresh();
    });
  }

  function startEdit(t: TaskWithCompletion) {
    setEditingId(t.id);
    setEditDraft({
      title: t.title,
      description: t.description ?? "",
      dueDate: t.due_date ?? "",
    });
  }

  function saveEdit() {
    if (!editDraft.title.trim() || !editingId) return;
    startTransition(async () => {
      await updateTaskAction({
        taskId: editingId,
        patientId,
        title: editDraft.title,
        description: editDraft.description,
        dueDate: editDraft.dueDate || null,
      });
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteTaskAction(id, patientId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Crear */}
      <div className="rounded-xl border border-black/[.08] p-4 dark:border-white/[.12]">
        <h3 className="text-sm font-semibold">Nueva tarea</h3>
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={creating.title}
            onChange={(e) => setCreating({ ...creating, title: e.target.value })}
            placeholder="Título"
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/[.16]"
          />
          <textarea
            value={creating.description}
            onChange={(e) =>
              setCreating({ ...creating, description: e.target.value })
            }
            placeholder="Descripción (opcional)"
            rows={2}
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/[.16]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              Fecha límite
              <input
                type="date"
                value={creating.dueDate}
                onChange={(e) =>
                  setCreating({ ...creating, dueDate: e.target.value })
                }
                className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm outline-none dark:border-white/[.16]"
              />
            </label>
            <button
              type="button"
              onClick={create}
              disabled={pending || !creating.title.trim()}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
            >
              Añadir tarea
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      {tasks.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay tareas asignadas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((t) =>
            editingId === t.id ? (
              <li
                key={t.id}
                className="rounded-lg border border-black/[.12] p-3 dark:border-white/[.16]"
              >
                <div className="flex flex-col gap-2">
                  <input
                    value={editDraft.title}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, title: e.target.value })
                    }
                    className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.16]"
                  />
                  <textarea
                    value={editDraft.description}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, description: e.target.value })
                    }
                    rows={2}
                    className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.16]"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={editDraft.dueDate}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, dueDate: e.target.value })
                      }
                      className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm dark:border-white/[.16]"
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={pending}
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-neutral-500 underline"
                    >
                      cancelar
                    </button>
                  </div>
                </div>
              </li>
            ) : (
              <li
                key={t.id}
                className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.12]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.title}</span>
                      {t.completed ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          hecha
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          pendiente
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
                        {t.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-neutral-400">
                      {t.due_date ? `Límite: ${formatDate(t.due_date)}` : "Sin fecha límite"}
                      {t.completed && t.lastCompletion
                        ? ` · Completada ${formatDateTime(t.lastCompletion.completed_at)}`
                        : ""}
                    </p>
                    {t.completed && t.lastCompletion?.response_text && (
                      <p className="mt-1 rounded bg-black/[.03] p-2 text-sm dark:bg-white/[.06]">
                        “{t.lastCompletion.response_text}”
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="text-xs text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
                    >
                      editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      disabled={pending}
                      className="text-xs text-neutral-500 underline hover:text-red-600 disabled:opacity-60"
                    >
                      eliminar
                    </button>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
