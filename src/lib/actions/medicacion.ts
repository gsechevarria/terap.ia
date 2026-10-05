"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { revalidatePaciente } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { requireOwnedPatient } from "@/lib/queries/identity";
import { medicamentoSchema, type MedicamentoInput } from "@/lib/medicacion";

/*
 * Escrituras del módulo de medicación. Solo el profesional del expediente.
 * La autoría (`updated_by`), el registro de cambios y la prohibición de borrar
 * los pone la base (20261006100001_medicacion.sql); aquí se valida para dar
 * mensajes claros y se refrescan las dos orillas.
 */

function refrescar(patientId: string) {
  revalidatePath(`/pro/patients/${patientId}`);
  revalidatePaciente();
}

async function guardarAjustes(
  patientId: string,
  cambios: { visible_paciente?: boolean; requiere_medicacion?: boolean | null },
) {
  const supabase = await createClient();
  const { data: actual, error: e1 } = await supabase
    .from("patient_medication")
    .select("patient_id, requiere_medicacion")
    .eq("patient_id", patientId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  // insert / update por separado y no upsert: así el registro de cambios
  // distingue la primera vez de las siguientes.
  const { error } = actual
    ? await supabase.from("patient_medication").update(cambios).eq("patient_id", patientId)
    : await supabase.from("patient_medication").insert({ patient_id: patientId, ...cambios });
  if (error) throw new Error(error.message);
  return actual;
}

async function setVisibilidadImpl(patientId: string, visible: boolean) {
  await requireOwnedPatient(patientId);
  await guardarAjustes(patientId, { visible_paciente: visible });
  refrescar(patientId);
}

async function setSituacionImpl(patientId: string, requiere: boolean | null) {
  await requireOwnedPatient(patientId);
  await guardarAjustes(patientId, { requiere_medicacion: requiere });
  refrescar(patientId);
}

async function guardarMedicamentoImpl(input: {
  patientId: string;
  id?: string;
  datos: MedicamentoInput;
}) {
  const { pro } = await requireOwnedPatient(input.patientId);
  const parsed = medicamentoSchema.safeParse(input.datos);
  if (!parsed.success) {
    throw new ActionInputError(parsed.error.issues[0]?.message ?? "Revisa los datos del medicamento.");
  }
  const supabase = await createClient();
  if (input.id) {
    const { data, error } = await supabase
      .from("medication_entries")
      .update(parsed.data)
      .eq("id", input.id)
      .eq("patient_id", input.patientId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ActionInputError("Medicamento no encontrado.");
  } else {
    const { error } = await supabase.from("medication_entries").insert({
      ...parsed.data,
      patient_id: input.patientId,
      professional_id: pro.id,
    });
    if (error) throw new Error(error.message);
    // Anotar un medicamento implica que hay pauta: si la situación estaba sin
    // indicar o en «no requiere», pasa a «con pauta».
    const { data: aj } = await supabase
      .from("patient_medication")
      .select("requiere_medicacion")
      .eq("patient_id", input.patientId)
      .maybeSingle();
    if (aj?.requiere_medicacion !== true) {
      await guardarAjustes(input.patientId, { requiere_medicacion: true });
    }
  }
  refrescar(input.patientId);
}

async function setRetiradoImpl(input: { patientId: string; id: string; retirado: boolean }) {
  await requireOwnedPatient(input.patientId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medication_entries")
    .update({ retirada_at: input.retirado ? new Date().toISOString() : null })
    .eq("id", input.id)
    .eq("patient_id", input.patientId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ActionInputError("Medicamento no encontrado.");
  refrescar(input.patientId);
}

export async function setVisibilidadMedicacionAction(...args: Parameters<typeof setVisibilidadImpl>) { return runAction(() => setVisibilidadImpl(...args)); }
export async function setSituacionMedicacionAction(...args: Parameters<typeof setSituacionImpl>) { return runAction(() => setSituacionImpl(...args)); }
export async function guardarMedicamentoAction(...args: Parameters<typeof guardarMedicamentoImpl>) { return runAction(() => guardarMedicamentoImpl(...args)); }
export async function setRetiradoMedicamentoAction(...args: Parameters<typeof setRetiradoImpl>) { return runAction(() => setRetiradoImpl(...args)); }
