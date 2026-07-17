import { createClient } from "@/lib/supabase/server";
import type { Task, TaskCompletion } from "@/lib/types";

export type TaskWithCompletion = Task & {
  completed: boolean;
  lastCompletion: Pick<TaskCompletion, "completed_at" | "response_text"> | null;
};

/** Tareas del paciente con su estado de completado (última realización). */
export async function getTasksForPatient(
  patientId: string,
): Promise<TaskWithCompletion[]> {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("patient_id", patientId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (!tasks || tasks.length === 0) return [];

  const { data: completions } = await supabase
    .from("task_completions")
    .select("task_id, completed_at, response_text")
    .eq("patient_id", patientId)
    .order("completed_at", { ascending: false });

  const byTask = new Map<
    string,
    Pick<TaskCompletion, "completed_at" | "response_text">
  >();
  for (const c of completions ?? []) {
    if (!byTask.has(c.task_id)) {
      byTask.set(c.task_id, {
        completed_at: c.completed_at,
        response_text: c.response_text,
      });
    }
  }

  return tasks.map((t) => ({
    ...t,
    completed: byTask.has(t.id),
    lastCompletion: byTask.get(t.id) ?? null,
  }));
}
