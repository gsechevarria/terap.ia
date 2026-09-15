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

/**
 * Pantallas del PACIENTE que dependen de lo que escribe el profesional.
 *
 * Existían solo en `revalidateRequests`, y esa asimetría dejaba al paciente
 * mirando datos viejos: crear una tarea o una cita refrescaba las siete rutas
 * del profesional y ninguna de las suyas. Toda escritura que el paciente deba
 * ver pasa por aquí.
 *
 * No lleva `patientId`: las rutas del paciente no lo llevan en la URL —cada uno
 * ve lo suyo por sesión—, así que se invalidan por ruta.
 */
export function revalidatePaciente(): void {
  revalidatePath("/app");
  revalidatePath("/app/appointments");
  revalidatePath("/app/payments");
  revalidatePath("/app/resources");
}

/** Un pago creado, modificado o borrado. */
export function revalidatePayments(patientId?: string): void {
  revalidatePath("/pro/pagos");
  revalidatePath("/pro/pagos/historico");
  revalidatePath("/pro/analitica");
  // Los ingresos cobrados alimentan `v_ingresos_fiscales` y, con ella, la
  // estimación del modelo 130 del dashboard de contabilidad.
  revalidatePath("/pro/contabilidad");
  if (patientId) revalidatePath(`/pro/patients/${patientId}`);
  // El paciente ve su deuda y su bono restante.
  revalidatePaciente();
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
  revalidatePath("/pro/solicitudes");
  if (patientId) revalidatePath(`/pro/patients/${patientId}`);
  // Una cita nueva es, sobre todo, algo que el paciente tiene que ver.
  revalidatePaciente();
}

/**
 * Una solicitud de cita. Toca las dos orillas: la bandeja del profesional y las
 * pantallas del paciente donde se ve lo que pidió.
 */
export function revalidateRequests(): void {
  revalidatePath("/pro", "layout"); // el contador del menú vive en el layout
  revalidatePath("/pro/solicitudes");
  revalidatePaciente();
}
