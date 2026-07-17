import type { Database } from "@/lib/database.types";

/** Alias de conveniencia para las filas de las tablas. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Professional = Tables<"professionals">;
export type Patient = Tables<"patients">;
export type Invitation = Tables<"invitations">;
export type Task = Tables<"tasks">;
export type TaskCompletion = Tables<"task_completions">;
export type ScaleAssignment = Tables<"scale_assignments">;
export type ScaleResponse = Tables<"scale_responses">;
export type Appointment = Tables<"appointments">;
export type Payment = Tables<"payments">;
export type SessionPack = Tables<"session_packs">;
export type MoodEntry = Tables<"mood_entries">;
export type ResourceRow = Tables<"resources">;
export type DocumentRow = Tables<"documents">;
export type PatientNote = Tables<"patient_notes">;

export type PatientStatus = Database["public"]["Enums"]["patient_status"];
