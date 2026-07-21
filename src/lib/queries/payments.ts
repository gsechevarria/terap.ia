import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient, getCurrentProfessional } from "@/lib/queries/identity";
import type { Payment, PaymentSetting, SessionPack } from "@/lib/types";

export const DEFAULT_SESSION_TYPE = "individual";

/** Pago + fecha de la sesión (cita) que lo originó, si la hay. */
export type PaymentWithSession = Payment & { sessionAt: string | null };

export type PatientPaymentDetail = {
  price: PaymentSetting | null;
  packs: SessionPack[];
  payments: PaymentWithSession[];
  debtCents: number;
  packRemaining: number;
};

/** Config de precio + bonos + pagos de un paciente (para la ficha). */
export async function getPatientPaymentDetail(
  patientId: string,
): Promise<PatientPaymentDetail> {
  const supabase = await createClient();
  const [priceRes, packRes, payRes] = await Promise.all([
    supabase
      .from("payment_settings")
      .select("*")
      .eq("patient_id", patientId)
      .eq("session_type", DEFAULT_SESSION_TYPE)
      .maybeSingle(),
    supabase
      .from("session_packs")
      .select("*")
      .eq("patient_id", patientId)
      .order("purchased_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*, appointments(starts_at)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);

  const payments: PaymentWithSession[] = (payRes.data ?? []).map((row) => {
    const { appointments, ...rest } = row as typeof row & {
      appointments: { starts_at: string } | null;
    };
    return { ...(rest as Payment), sessionAt: appointments?.starts_at ?? null };
  });
  const packs = packRes.data ?? [];
  const debtCents = payments
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + p.amount_cents, 0);
  const packRemaining = packs
    .filter((p) => p.active)
    .reduce((s, p) => s + (p.total_sessions - p.used_sessions), 0);

  return {
    price: priceRes.data ?? null,
    packs,
    payments,
    debtCents,
    packRemaining,
  };
}

export type MonthIncome = { month: string; paidCents: number; count: number };
export type PaymentsOverview = {
  byMonth: MonthIncome[];
  totalPaidCents: number;
  totalPendingCents: number;
};

/** Resumen de ingresos del profesional: por mes + totales. */
export async function getPaymentsOverview(): Promise<PaymentsOverview> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return { byMonth: [], totalPaidCents: 0, totalPendingCents: 0 };

  const { data } = await supabase
    .from("payments")
    .select("amount_cents, status, paid_at, created_at")
    .eq("professional_id", pro.id);

  const rows = data ?? [];
  const monthMap = new Map<string, { paidCents: number; count: number }>();
  let totalPaidCents = 0;
  let totalPendingCents = 0;

  for (const r of rows) {
    if (r.status === "paid") {
      totalPaidCents += r.amount_cents;
      const when = r.paid_at ?? r.created_at;
      const month = when.slice(0, 7); // YYYY-MM
      const cur = monthMap.get(month) ?? { paidCents: 0, count: 0 };
      cur.paidCents += r.amount_cents;
      cur.count += 1;
      monthMap.set(month, cur);
    } else {
      totalPendingCents += r.amount_cents;
    }
  }

  const byMonth = [...monthMap.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return { byMonth, totalPaidCents, totalPendingCents };
}

/** Métodos filtrables en el histórico (incluye "none" = sin especificar). */
export const PAYMENT_METHOD_FILTERS = [
  "transferencia",
  "bizum",
  "efectivo",
  "bono",
  "none",
] as const;

export type PaymentFilters = {
  /** Límite inferior inclusivo (ISO) sobre la fecha efectiva (paid_at ?? created_at). */
  fromISO?: string;
  /** Límite superior exclusivo (ISO) sobre la fecha efectiva. */
  toISO?: string;
  status?: "paid" | "pending";
  /** Uno de PAYMENT_METHOD_FILTERS; "none" = método sin especificar. */
  method?: string;
  patientId?: string;
};

/** Fila del histórico: pago + nombre de paciente + fecha de sesión (si la hay). */
export type PaymentHistoryRow = PaymentWithSession & { patientName: string | null };

export type MethodBreakdown = {
  method: string;
  paidCents: number;
  count: number;
};

export type PaymentHistory = {
  rows: PaymentHistoryRow[];
  totalPaidCents: number;
  totalPendingCents: number;
  paidCount: number;
  pendingCount: number;
  /** Reparto del cobrado por método (solo pagos "paid"), de mayor a menor. */
  byMethod: MethodBreakdown[];
  /** Ingresos cobrados por mes (YYYY-MM), de más reciente a más antiguo. */
  byMonth: MonthIncome[];
};

const EMPTY_HISTORY: PaymentHistory = {
  rows: [],
  totalPaidCents: 0,
  totalPendingCents: 0,
  paidCount: 0,
  pendingCount: 0,
  byMethod: [],
  byMonth: [],
};

/**
 * Pagos del profesional con filtros (rango de fechas, estado, método, paciente)
 * y agregados sobre el conjunto filtrado. La fecha efectiva de cada pago es
 * `paid_at ?? created_at`; el filtro de rango se aplica en JS sobre ella para
 * ser consistente con lo que se muestra. Para seguimiento, nunca facturación.
 */
export async function getProfessionalPayments(
  filters: PaymentFilters = {},
): Promise<PaymentHistory> {
  const supabase = await createClient();
  const pro = await getCurrentProfessional();
  if (!pro) return EMPTY_HISTORY;

  let q = supabase
    .from("payments")
    .select("*, patients(full_name), appointments(starts_at)")
    .eq("professional_id", pro.id);

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.patientId) q = q.eq("patient_id", filters.patientId);
  if (filters.method === "none") q = q.is("method", null);
  else if (filters.method) q = q.eq("method", filters.method);

  const { data } = await q;

  const fromMs = filters.fromISO ? Date.parse(filters.fromISO) : null;
  const toMs = filters.toISO ? Date.parse(filters.toISO) : null;
  const effective = (p: Payment) => p.paid_at ?? p.created_at;

  const rows: PaymentHistoryRow[] = [];
  for (const row of data ?? []) {
    const { patients, appointments, ...rest } = row as typeof row & {
      patients: { full_name: string | null } | null;
      appointments: { starts_at: string } | null;
    };
    const payment = rest as Payment;
    const whenMs = Date.parse(effective(payment));
    if (fromMs !== null && whenMs < fromMs) continue;
    if (toMs !== null && whenMs >= toMs) continue;
    rows.push({
      ...payment,
      sessionAt: appointments?.starts_at ?? null,
      patientName: patients?.full_name ?? null,
    });
  }

  rows.sort((a, b) => Date.parse(effective(b)) - Date.parse(effective(a)));

  let totalPaidCents = 0;
  let totalPendingCents = 0;
  let paidCount = 0;
  let pendingCount = 0;
  const methodMap = new Map<string, { paidCents: number; count: number }>();
  const monthMap = new Map<string, { paidCents: number; count: number }>();

  for (const p of rows) {
    if (p.status === "paid") {
      totalPaidCents += p.amount_cents;
      paidCount += 1;
      const mKey = p.method ?? "none";
      const m = methodMap.get(mKey) ?? { paidCents: 0, count: 0 };
      m.paidCents += p.amount_cents;
      m.count += 1;
      methodMap.set(mKey, m);
      const month = effective(p).slice(0, 7); // YYYY-MM
      const mm = monthMap.get(month) ?? { paidCents: 0, count: 0 };
      mm.paidCents += p.amount_cents;
      mm.count += 1;
      monthMap.set(month, mm);
    } else {
      totalPendingCents += p.amount_cents;
      pendingCount += 1;
    }
  }

  const byMethod = [...methodMap.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.paidCents - a.paidCents);
  const byMonth = [...monthMap.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    rows,
    totalPaidCents,
    totalPendingCents,
    paidCount,
    pendingCount,
    byMethod,
    byMonth,
  };
}

export type MyPaymentSummary = {
  payments: Payment[];
  debtCents: number;
  packRemaining: number;
};

/** Resumen de pagos del paciente actual (pendiente + bono restante). */
export async function getMyPaymentSummary(): Promise<MyPaymentSummary> {
  const supabase = await createClient();
  const patient = await getCurrentPatient();
  if (!patient) return { payments: [], debtCents: 0, packRemaining: 0 };

  const [{ data: payments }, { data: packs }] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("session_packs")
      .select("total_sessions, used_sessions, active")
      .eq("patient_id", patient.id),
  ]);

  const debtCents = (payments ?? [])
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + p.amount_cents, 0);
  const packRemaining = (packs ?? [])
    .filter((p) => p.active)
    .reduce((s, p) => s + (p.total_sessions - p.used_sessions), 0);

  return { payments: payments ?? [], debtCents, packRemaining };
}
