import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata = { title: "Pagos · Terap" };

export default async function PatientPaymentsPage() {
  const { payments, debtCents, packRemaining } = await getMyPaymentSummary();
  const pendientes = payments.filter((p) => p.status === "pending");

  return (
    <>
      <Link href="/app/more" className="tp-back">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        Más
      </Link>

      <div className="tp-page-heading">
        <div>
          <h1 className="tp-h1">Pagos</h1>
        </div>
      </div>

      <dl className="tp-metric-grid">
        <div className="tp-metric">
          <dt>Pendiente de pago</dt>
          <dd>{formatCurrency(debtCents)}</dd>
        </div>
        <div className="tp-metric">
          <dt>Sesiones de bono</dt>
          <dd>{packRemaining}</dd>
        </div>
      </dl>

      <section className="tp-space-top" aria-labelledby="tp-pendientes">
        <div className="tp-section-heading">
          <h2 className="tp-h2" id="tp-pendientes">
            Pendiente de pago
          </h2>
        </div>

        {pendientes.length === 0 ? (
          <p className="tp-section-desc">No tienes pagos pendientes.</p>
        ) : (
          <div className="tp-card" style={{ marginTop: 14 }}>
            {pendientes.map((p) => (
              <div key={p.id} className="tp-list-row">
                <span className="tp-list-label">
                  {formatCurrency(p.amount_cents, p.currency)}
                </span>
                <span className="tp-list-hint">{formatDate(p.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* La app hace seguimiento de pagos, no facturación: no emite ninguna
            factura ni cobra nada. El aviso se conserva tal cual estaba. */}
        <p className="tp-section-desc">
          Es un seguimiento informativo. El pago se acuerda con tu profesional;
          desde aquí no se cobra nada.
        </p>
      </section>
    </>
  );
}
