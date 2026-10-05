import { createClient } from "@/lib/supabase/server";
import { checked } from "@/lib/query-result";
import { getCurrentPatient } from "@/lib/queries/identity";
import type { Medicamento } from "@/lib/medicacion";

const COLUMNAS =
  "id, nombre, dosis, momentos, horario, frecuencia, dias_semana, con_comida, instrucciones, prescrito_por, fecha_inicio, fecha_fin, retirada_at";

export type AjustesMedicacion = {
  visible_paciente: boolean;
  requiere_medicacion: boolean | null;
};

export type CambioMedicacion = {
  id: number;
  accion: string;
  created_at: string;
  autor: string | null;
  medicamento: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
};

/** Ficha del profesional: ajustes, medicamentos (vigentes y retirados) y cambios. */
export async function getMedicacionProfesional(patientId: string): Promise<{
  ajustes: AjustesMedicacion;
  medicamentos: Medicamento[];
  cambios: CambioMedicacion[];
}> {
  const supabase = await createClient();
  const [aj, meds, log] = await Promise.all([
    checked(supabase
      .from("patient_medication")
      .select("visible_paciente, requiere_medicacion")
      .eq("patient_id", patientId)
      .maybeSingle()),
    checked(supabase
      .from("medication_entries")
      .select(COLUMNAS)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true })),
    checked(supabase
      .from("medication_changes")
      .select("id, accion, created_at, antes, despues, professionals!professional_id(full_name), medication_entries(nombre)")
      .eq("patient_id", patientId)
      .order("id", { ascending: false })
      .limit(30)),
  ]);
  return {
    ajustes: aj.data ?? { visible_paciente: false, requiere_medicacion: null },
    medicamentos: (meds.data ?? []) as Medicamento[],
    cambios: (log.data ?? []).map((c) => {
      const fila = c as typeof c & {
        professionals: { full_name: string | null } | null;
        medication_entries: { nombre: string } | null;
      };
      return {
        id: fila.id,
        accion: fila.accion,
        created_at: fila.created_at,
        autor: fila.professionals?.full_name ?? null,
        medicamento: fila.medication_entries?.nombre ?? null,
        antes: (fila.antes as Record<string, unknown> | null) ?? null,
        despues: (fila.despues as Record<string, unknown> | null) ?? null,
      };
    }),
  };
}

/**
 * App del paciente. `null` si el módulo no está activado para él: la RLS no
 * devuelve la fila, así que la app no puede enseñar algo que la base oculta.
 * Solo los medicamentos no retirados.
 */
export async function getMiMedicacion(): Promise<{
  requiere_medicacion: boolean | null;
  medicamentos: Medicamento[];
} | null> {
  const patient = await getCurrentPatient();
  if (!patient) return null;
  const supabase = await createClient();
  const { data: aj } = await checked(supabase
    .from("patient_medication")
    .select("requiere_medicacion, visible_paciente")
    .eq("patient_id", patient.id)
    .maybeSingle());
  if (!aj?.visible_paciente) return null;
  const { data } = await checked(supabase
    .from("medication_entries")
    .select(COLUMNAS)
    .eq("patient_id", patient.id)
    .is("retirada_at", null)
    .order("created_at", { ascending: true }));
  return {
    requiere_medicacion: aj.requiere_medicacion,
    medicamentos: (data ?? []) as Medicamento[],
  };
}
