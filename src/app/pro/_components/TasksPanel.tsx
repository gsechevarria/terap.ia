"use client";
import { callAction } from "@/lib/action-result";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "@/lib/actions/tasks";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { Status } from "@/components/ui/Status";
import type { TaskWithCompletion } from "@/lib/queries/tasks";

type Draft = { title: string; description: string; dueDate: string };

const EMPTY: Draft = { title: "", description: "", dueDate: "" };

/**
 * `today` y `soon` llegan resueltos desde el server component (`todayYMD()` en
 * la zona del profesional). Antes se calculaban tras montar con un `setState`
 * dentro de un efecto: además de provocar un parpadeo, el React Compiler lo
 * prohíbe por las cascadas de render que genera.
 */
export function TasksPanel({
  patientId,
  tasks,
  today,
  soon,
}: {
  patientId: string;
  tasks: TaskWithCompletion[];
  /** Hoy en la zona del profesional, 'YYYY-MM-DD'. */
  today: string;
  /** Hoy + 2 días: umbral de "vence pronto". */
  soon: string;
}) {
  const [creating, setCreating] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const { run, pending, error } = useAction();

  /**
   * Color de la fecha límite según urgencia (solo tareas pendientes). Va en la
   * tinta del texto y no en una pastilla rellena: el vencimiento es un dato
   * operativo, no una alarma clínica.
   */
  function dueTone(t: TaskWithCompletion): string {
    if (!t.due_date || t.completed) return "text-ink-3";
    if (t.due_date < today) return "text-danger";
    if (t.due_date <= soon) return "text-warning-ink";
    return "text-ink-3";
  }

  function create() {
    if (!creating.title.trim()) return;
    run(
      () =>
        callAction(createTaskAction, {
          patientId,
          title: creating.title,
          description: creating.description,
          dueDate: creating.dueDate || null,
        }),
      () => setCreating(EMPTY),
    );
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
    run(
      () =>
        callAction(updateTaskAction, {
          taskId: editingId,
          patientId,
          title: editDraft.title,
          description: editDraft.description,
          dueDate: editDraft.dueDate || null,
        }),
      () => setEditingId(null),
    );
  }

  function remove(id: string) {
    run(() => callAction(deleteTaskAction, id, patientId));
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Crear */}
      <section>
        <h2 className="section-title mb-3.5">Nueva tarea</h2>
        <div className="flex max-w-xl flex-col gap-3">
          <label className="block">
            <span className="field-label">Título</span>
            <input
              value={creating.title}
              onChange={(e) =>
                setCreating({ ...creating, title: e.target.value })
              }
              className="field"
            />
          </label>
          <label className="block">
            <span className="field-label">Descripción (opcional)</span>
            <textarea
              value={creating.description}
              onChange={(e) =>
                setCreating({ ...creating, description: e.target.value })
              }
              rows={2}
              className="field"
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="field-label">Fecha límite</span>
              <input
                type="date"
                value={creating.dueDate}
                onChange={(e) =>
                  setCreating({ ...creating, dueDate: e.target.value })
                }
                className="field w-auto"
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
      </section>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      {/* Lista */}
      <section className="border-t border-line pt-7">
        <h2 className="section-title mb-1">Tareas asignadas</h2>
        {tasks.length === 0 ? (
          <p className="py-3 text-[13.5px] text-ink-3">
            No tiene ninguna tarea. Crea la primera con el formulario de arriba.
          </p>
        ) : (
          <ul>
            {tasks.map((t) =>
              editingId === t.id ? (
                <li key={t.id} className="border-b border-line-soft py-4 last:border-b-0">
                  <div className="flex max-w-xl flex-col gap-3">
                    <input
                      value={editDraft.title}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, title: e.target.value })
                      }
                      aria-label="Título de la tarea"
                      className="field"
                    />
                    <textarea
                      value={editDraft.description}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, description: e.target.value })
                      }
                      rows={2}
                      aria-label="Descripción de la tarea"
                      className="field"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={editDraft.dueDate}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, dueDate: e.target.value })
                        }
                        aria-label="Fecha límite"
                        className="field w-auto"
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
                <li
                  key={t.id}
                  className="group border-b border-line-soft py-3.5 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-[13.5px] font-medium">{t.title}</span>
                        {t.completed ? (
                          <Status tone="success">hecha</Status>
                        ) : (
                          <Status tone="warn">pendiente</Status>
                        )}
                      </div>
                      {t.description && (
                        <p className="mt-1 text-[13.5px] whitespace-pre-wrap text-ink-2">
                          {t.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px]">
                        {t.due_date ? (
                          <span
                            className={`inline-flex items-center gap-1.5 ${dueTone(t)}`}
                            title={`Fecha límite: ${formatDate(t.due_date)}`}
                          >
                            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                            Límite {formatDate(t.due_date)}
                            {!t.completed && t.due_date < today && (
                              <span className="font-semibold">, vencida</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-ink-3">Sin fecha límite</span>
                        )}
                        {t.completed && t.lastCompletion && (
                          <span className="text-ink-3">
                            Completada{" "}
                            {formatDateTime(t.lastCompletion.completed_at)}
                          </span>
                        )}
                      </div>
                      {t.completed && t.lastCompletion?.response_text && (
                        <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2.5 text-[13.5px] text-ink-2">
                          “{t.lastCompletion.response_text}”
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-100 transition-opacity duration-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
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
      </section>
    </div>
  );
}
