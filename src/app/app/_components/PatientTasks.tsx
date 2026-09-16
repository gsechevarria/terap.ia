"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ListTodo,
  X,
} from "lucide-react";
import { callAction } from "@/lib/action-result";
import { completeTaskAction } from "@/lib/actions/patient-tasks";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import type { TaskWithCompletion } from "@/lib/queries/tasks";

/**
 * Tareas del paciente: lista en la pantalla, detalle en un panel inferior.
 *
 * El panel es un `<dialog>` nativo, así que Escape, el atrapado de foco y el
 * fondo inerte los da el navegador y no hay que reimplementarlos.
 *
 * `hoy` llega resuelto desde el server component (en hora española). Antes se
 * calculaba con `new Date()` durante el render de este componente —que también
 * se renderiza en servidor—: en UTC salía otro día, la etiqueta "vencida" era
 * incorrecta y rompía la hidratación.
 */
export function PatientTasks({
  tasks,
  hoy,
}: {
  tasks: TaskWithCompletion[];
  hoy: string;
}) {
  const pendientes = tasks.filter((t) => !t.completed);
  const hechas = tasks.filter((t) => t.completed);
  const [abierta, setAbierta] = useState<TaskWithCompletion | null>(null);

  return (
    <section className="tp-task-section" aria-labelledby="tp-tareas">
      <div className="tp-section-heading">
        <h2 className="tp-h2" id="tp-tareas">
          Para esta semana
        </h2>
        {pendientes.length > 0 && (
          <span className="tp-count">
            {pendientes.length} {pendientes.length === 1 ? "tarea" : "tareas"}
          </span>
        )}
      </div>

      {pendientes.length === 0 ? (
        <p className="tp-section-desc">
          {hechas.length > 0
            ? "No te queda ninguna tarea pendiente."
            : "Tu profesional aún no te ha propuesto ninguna tarea."}
        </p>
      ) : (
        <div className="tp-task-list">
          {pendientes.map((t, i) => (
            <FilaTarea
              key={t.id}
              task={t}
              hoy={hoy}
              tono={i % 2 === 0 ? "tp-tile-blue" : "tp-tile-peach"}
              onAbrir={() => setAbierta(t)}
            />
          ))}
        </div>
      )}

      {hechas.length > 0 && (
        <details className="tp-disclosure">
          <summary>
            <ChevronDown size={15} strokeWidth={1.8} aria-hidden />
            Completadas ({hechas.length})
          </summary>
          <div className="tp-task-list">
            {hechas.map((t) => (
              <div className="tp-row" key={t.id}>
                <span className="tp-tile-icon tp-tile-blue">
                  <Check size={21} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="tp-row-text">
                  <strong>{t.title}</strong>
                  {t.lastCompletion && (
                    <small>{formatDateTime(t.lastCompletion.completed_at)}</small>
                  )}
                  {t.lastCompletion?.response_text && (
                    <small>“{t.lastCompletion.response_text}”</small>
                  )}
                  <span className="tp-badge-done">Hecha</span>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <PanelTarea
        task={abierta}
        hoy={hoy}
        onCerrar={() => setAbierta(null)}
      />
    </section>
  );
}

/** Ambas fechas son 'YYYY-MM-DD', así que se comparan como texto. */
function vencimiento(
  due: string | null,
  hoy: string,
): "hoy" | "vencida" | null {
  if (!due) return null;
  if (due < hoy) return "vencida";
  if (due === hoy) return "hoy";
  return null;
}

function FilaTarea({
  task,
  hoy,
  tono,
  onAbrir,
}: {
  task: TaskWithCompletion;
  hoy: string;
  tono: string;
  onAbrir: () => void;
}) {
  const estado = vencimiento(task.due_date, hoy);

  return (
    <button type="button" className="tp-row" onClick={onAbrir}>
      <span className={`tp-tile-icon ${tono}`}>
        <ListTodo size={22} strokeWidth={1.6} aria-hidden />
      </span>
      <span className="tp-row-text">
        <strong>{task.title}</strong>
        {task.due_date && <small>Fecha prevista · {formatDate(task.due_date)}</small>}
        {estado === "vencida" && <span className="tp-badge-late">Fecha pasada</span>}
        {estado === "hoy" && <span className="tp-badge-done">Para hoy</span>}
      </span>
      <ChevronRight size={17} strokeWidth={1.8} aria-hidden className="tp-chevron" />
    </button>
  );
}

/**
 * Panel inferior con el detalle real de la tarea y la única acción que el
 * paciente puede hacer sobre ella. La maqueta enseñaba aquí un aviso de
 * diseño; esto ejecuta `completeTaskAction` y no cierra hasta que el servidor
 * confirma.
 */
function PanelTarea({
  task,
  hoy,
  onCerrar,
}: {
  task: TaskWithCompletion | null;
  hoy: string;
  onCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [nota, setNota] = useState("");
  const { run, pending, error, clearError } = useAction();

  useEffect(() => {
    const nodo = dialogo.current;
    if (!nodo) return;
    if (task && !nodo.open) {
      setNota("");
      clearError();
      nodo.showModal();
    } else if (!task && nodo.open) {
      nodo.close();
    }
  }, [task, clearError]);

  function completar() {
    if (!task) return;
    run(() => callAction(completeTaskAction, task.id, nota), onCerrar);
  }

  const estado = task ? vencimiento(task.due_date, hoy) : null;

  return (
    <dialog
      ref={dialogo}
      className="tp-sheet"
      aria-labelledby="tp-sheet-title"
      onClose={onCerrar}
      onCancel={onCerrar}
    >
      <span className="tp-sheet-handle" aria-hidden />
      <button
        type="button"
        className="tp-sheet-close"
        onClick={onCerrar}
        aria-label="Cerrar"
      >
        <X size={22} strokeWidth={1.8} aria-hidden />
      </button>

      {task && (
        <>
          <p className="tp-sheet-eyebrow">Tu tarea</p>
          <h2 className="tp-sheet-title" id="tp-sheet-title">
            {task.title}
          </h2>

          {(task.due_date || estado) && (
            <div className="tp-sheet-meta">
              {task.due_date && (
                <span className="tp-status tp-status-muted">
                  Fecha prevista · {formatDate(task.due_date)}
                </span>
              )}
              {estado === "vencida" && (
                <span className="tp-badge-late">Fecha pasada</span>
              )}
              {estado === "hoy" && <span className="tp-badge-done">Para hoy</span>}
            </div>
          )}

          {task.description && <p className="tp-sheet-body">{task.description}</p>}

          <label className="tp-label" htmlFor="tp-task-note">
            ¿Cómo te ha ido?
            <span>Opcional</span>
          </label>
          <textarea
            id="tp-task-note"
            className="tp-textarea"
            rows={3}
            maxLength={2000}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Puedes contarle algo a tu profesional."
          />

          {error && <p className="tp-inline-error tp-space-top">{error}</p>}

          <div className="tp-sheet-actions">
            <button
              type="button"
              className="tp-primary tp-wide"
              onClick={completar}
              disabled={pending}
            >
              {pending ? "Guardando…" : "Marcar como hecha"}
              {!pending && <Check size={19} strokeWidth={2} aria-hidden />}
            </button>
            <button
              type="button"
              className="tp-secondary tp-wide"
              onClick={onCerrar}
              disabled={pending}
            >
              Ahora no
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
