"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "@/lib/actions/tasks";
import { formatDate, formatDateTime } from "@/lib/format";
import { Status } from "@/components/ui/Status";
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
      <div className="card bg-panel p-4">
        <h3 className="section-label">Nueva tarea</h3>
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={creating.title}
            onChange={(e) => setCreating({ ...creating, title: e.target.value })}
            placeholder="Título"
            className="field"
          />
          <textarea
            value={creating.description}
            onChange={(e) =>
              setCreating({ ...creating, description: e.target.value })
            }
            placeholder="Descripción (opcional)"
            rows={2}
            className="field"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
              Fecha límite
              <input
                type="date"
                value={creating.dueDate}
                onChange={(e) =>
                  setCreating({ ...creating, dueDate: e.target.value })
                }
                className="field w-auto px-2 py-1"
              />
            </label>
            <button
              type="button"
              onClick={create}
              disabled={pending || !creating.title.trim()}
              className="btn-primary"
            >
              Añadir tarea
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      {tasks.length === 0 ? (
        <p className="text-sm text-ink-2">No hay tareas asignadas.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {tasks.map((t) =>
            editingId === t.id ? (
              <li key={t.id} className="p-4">
                <div className="flex flex-col gap-2">
                  <input
                    value={editDraft.title}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, title: e.target.value })
                    }
                    className="field"
                  />
                  <textarea
                    value={editDraft.description}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, description: e.target.value })
                    }
                    rows={2}
                    className="field"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={editDraft.dueDate}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, dueDate: e.target.value })
                      }
                      className="field w-auto px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={pending}
                      className="btn-primary btn-sm"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="btn-subtle btn-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </li>
            ) : (
              <li key={t.id} className="group p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.title}</span>
                      {t.completed ? (
                        <Status tone="success">hecha</Status>
                      ) : (
                        <Status tone="warn">pendiente</Status>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-1 text-sm whitespace-pre-wrap text-ink-2">
                        {t.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-ink-3">
                      {t.due_date
                        ? `Límite: ${formatDate(t.due_date)}`
                        : "Sin fecha límite"}
                      {t.completed && t.lastCompletion
                        ? ` · Completada ${formatDateTime(t.lastCompletion.completed_at)}`
                        : ""}
                    </p>
                    {t.completed && t.lastCompletion?.response_text && (
                      <p className="mt-2 rounded bg-panel p-2.5 text-sm text-ink-2">
                        “{t.lastCompletion.response_text}”
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="btn-subtle btn-sm"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      disabled={pending}
                      className="btn-danger btn-sm"
                    >
                      Eliminar
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
