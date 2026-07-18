import { createClient } from "@/lib/supabase/server";
import { getCurrentPatient, getCurrentProfessional } from "@/lib/queries/identity";
import type { Payment, PaymentSetting, SessionPack } from "@/lib/types";

export const DEFAULT_SESSION_TYPE = "individual";

export type PatientPaymentDetail = {
  price: PaymentSetting | null;
  packs: SessionPack[];
  payments: Payment[];
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
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);

  const payments = payRes.data ?? [];
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

export type ExportPaymentRow = Payment & { patientName: string | null };

/** Todos los pagos del profesional con nombre de paciente (para export CSV). */
export async function getAllPaymentsForExport(): Promise<ExportPaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, patients(full_name)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((p) => {
    const { patients, ...rest } = p as typeof p & {
      patients: { full_name: string | null } | null;
    };
    return { ...(rest as Payment), patientName: patients?.full_name ?? null };
  });
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
