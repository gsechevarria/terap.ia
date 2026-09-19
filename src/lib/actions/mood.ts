"use server";
import { runAction } from "@/lib/action-server";
import { ActionInputError } from "@/lib/action-result";

import { todayYMD } from "@/lib/tz";
import { revalidatePath } from "next/cache";
import { revalidateProfesional } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient } from "@/lib/queries/identity";
import { ESCALA_ACTUAL, validarRegistro } from "@/lib/diario";

/**
 * El paciente registra su estado del día.
 *
 * Lo que decide el servidor, y no el cliente:
 *
 *  · **El expediente.** Sale de la sesión (`getCurrentPatient`), nunca de un
 *    parámetro. No hay forma de escribir en la ficha de otro pasando un id.
 *  · **El día.** `todayYMD()` en hora española, la misma zona de negocio que
 *    usa la política de la tabla. No se acepta una fecha del cliente, así que
 *    no se puede retrodatar para tocar un registro cerrado.
 *  · **La escala.** Se graba `ESCALA_ACTUAL`; el cliente no la envía. Sin esto
 *    bastaría con mandar un 5 diciendo que es de la escala vieja.
 *
 * Y por encima de todo eso sigue estando la RLS, que vuelve a comprobar
 * propiedad y fecha: esta función no es la frontera, es la primera puerta.
 *
 * **Un registro por día y expediente**, sostenido por el índice único
 * `mood_entries_patient_day_uq`. Por eso es un `upsert` y no un `insert`: una
 * doble pulsación o un reintento actualizan la misma fila en vez de crear otra.
 */
async function addMoodEntryActionImpl(value: number, note?: string) {
  const patient = await getCurrentPatient();
  if (!patient) throw new ActionInputError("Cuenta no vinculada.");

  const validado = validarRegistro(value, note);
  if (!validado.ok) throw new ActionInputError(validado.error);
  const { valor, nota } = validado.registro;

  const supabase = await createClient();
  const { error } = await supabase.from("mood_entries").upsert(
    {
      entry_date: todayYMD(),
      patient_id: patient.id,
      mood_value: valor,
      mood_scale: ESCALA_ACTUAL,
      note: nota,
    },
    { onConflict: "patient_id,entry_date" },
  );
  // El mensaje crudo de Postgres no se propaga: puede llevar el contenido de la
  // fila, y la fila lleva la nota.
  if (error) throw new Error("No se ha podido guardar tu estado. Inténtalo de nuevo.");

  revalidatePath("/app");
  revalidatePath("/app/diary");
  // El profesional ve el diario en la pestaña Diario y la última actividad en
  // su listado de pacientes.
  revalidateProfesional(patient.id);
}

async function deleteMoodEntryActionImpl(id: string) {
  const patient = await getCurrentPatient();
  if (!patient) throw new ActionInputError("Cuenta no vinculada.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("mood_entries")
    .delete()
    .eq("id", id)
    .eq("patient_id", patient.id);
  if (error) throw new Error("No se ha podido borrar el registro. Inténtalo de nuevo.");
  revalidatePath("/app/diary");
  revalidateProfesional(patient.id);
}

export async function addMoodEntryAction(...args: Parameters<typeof addMoodEntryActionImpl>) { return runAction(() => addMoodEntryActionImpl(...args)); }

export async function deleteMoodEntryAction(...args: Parameters<typeof deleteMoodEntryActionImpl>) { return runAction(() => deleteMoodEntryActionImpl(...args)); }
