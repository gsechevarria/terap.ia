import { createClient } from "@/lib/supabase/server";

/**
 * Liquida una cita marcada como "acudió":
 *  - si el paciente tiene un bono activo con sesiones, consume una (used++) y
 *    registra la sesión a 0 € (el ingreso del bono se registró al VENDERLO);
 *  - si no, crea un pago PENDIENTE con la tarifa aplicable.
 *
 * Todo ocurre dentro de la RPC `settle_attended_appointment`: antes eran un
 * SELECT y varios INSERT/UPDATE sueltos desde Node, sin transacción y sin
 * unicidad en BD, así que dos clics en "acudió" creaban dos pagos para la misma
 * cita y descontaban una sola sesión del bono (el `used_sessions + 1` se leía
 * en JS). La RPC bloquea la cita y el bono con `for update`, y ahora hay un
 * índice único sobre `payments.appointment_id`.
 *
 * NUNCA emite facturas: solo registra el seguimiento del pago.
 */
export async function settleAttendedAppointment(
  appointmentId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_attended_appointment", {
    p_appointment_id: appointmentId,
  });
  if (error) throw new Error(error.message);
}

/** Qué ha hecho `unsettle_appointment`. */
export type UnsettleResult =
  | "sin_pago"
  | "bono_devuelto"
  | "borrado"
  | "conservado_cobrado";

/**
 * Deshace la liquidación de una cita.
 *
 * Hace falta al corregir un "acudió" puesto por error, y al cancelar o borrar
 * una cita ya liquidada: sin esto el bono quedaba consumido (el paciente perdía
 * una sesión pagada) y, al borrar, `payments.appointment_id` pasaba a NULL
 * dejando un pago huérfano imposible de reconciliar.
 *
 * Es conservadora: devuelve la sesión al bono y borra el pago automático, pero
 * NO borra un pago que ya estuviera marcado como cobrado — eso sería perder el
 * registro de un cobro real. **Devuelve qué ha hecho** para que la interfaz lo
 * pueda decir: hacerlo en silencio era indistinguible de un fallo.
 */
export async function unsettleAppointment(
  appointmentId: string,
): Promise<UnsettleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unsettle_appointment", {
    p_appointment_id: appointmentId,
  });
  if (error) throw new Error(error.message);
  return (data as UnsettleResult | null) ?? "sin_pago";
}
