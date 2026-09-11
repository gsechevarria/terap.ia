import { revalidatePath } from "next/cache";

/**
 * Rutas dependientes agrupadas por dominio.
 *
 * `revalidatePath` sobre una ruta inexistente es un **no-op silencioso**, y el
 * mismo dato agregado se pinta en varias pantallas con rutas distintas
 * (`/pro/pagos`, `/pro/pagos/historico`, `/pro/analitica`…). Olvidar una deja
 * al profesional mirando cifras viejas sin ningún error visible, así que la
 * lista vive aquí en vez de repetida en cada action.
 *
 * Migración natural cuando haga falta invalidar por profesional en vez de por
 * ruta: `revalidateTag` con etiquetas de dominio (`pagos:${proId}`,
 * `agenda:${proId}`), etiquetando las queries correspondientes.
 */

/** Un pago creado, modificado o borrado. */
export function revalidatePayments(patientId?: string): void {
  revalidatePath("/pro/pagos");
  revalidatePath("/pro/pagos/historico");
  revalidatePath("/pro/analitica");
  // Los ingresos cobrados alimentan `v_ingresos_fiscales` y, con ella, la
  // estimación del modelo 130 del dashboard de contabilidad.
  revalidatePath("/pro/contabilidad");
  if (patientId) revalidatePath(`/pro/patients/${patientId}`);
}

/** Un gasto, un bien de inversión o la configuración fiscal. */
export function revalidateContabilidad(): void {
  revalidatePath("/pro/contabilidad");
  revalidatePath("/pro/contabilidad/gastos");
  revalidatePath("/pro/contabilidad/configuracion");
  revalidatePath("/pro/contabilidad/exportar");
}

/** Una cita o un bloqueo de agenda. */
export function revalidateAgenda(patientId?: string): void {
  revalidatePath("/pro");
  revalidatePath("/pro/agenda");
  revalidatePath("/pro/agenda/citas");
  if (patientId) revalidatePath(`/pro/patients/${patientId}`);
}
