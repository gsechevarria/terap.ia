/**
 * Métodos de pago para el seguimiento (NO facturación).
 * El profesional elige cómo cobró cada sesión; "bono" se fija solo al consumir
 * un pack (ver `settleAttendedAppointment`) y no es una opción manual.
 */
export const PAYMENT_METHODS = ["transferencia", "bizum", "efectivo"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  bizum: "Bizum",
  efectivo: "Efectivo",
  bono: "Bono",
};

/** Etiqueta legible de un método (incluye "bono", que se fija automáticamente). */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  return LABELS[method] ?? method;
}

/** ¿Es uno de los métodos que el profesional puede registrar manualmente? */
export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}
