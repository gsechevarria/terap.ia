import Link from "next/link";
import {
  Bell,
  ChevronRight,
  CreditCard,
  KeyRound,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { formatCurrency } from "@/lib/format";
import { SignOutForm } from "@/components/SignOutForm";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata = { title: "Más · Terap" };

function Fila({
  href,
  label,
  hint,
  Icon,
}: {
  href: string;
  label: string;
  hint?: string;
  Icon: LucideIcon;
}) {
  return (
    <Link href={href} className="tp-list-row">
      <Icon size={18} strokeWidth={1.7} aria-hidden />
      <span className="tp-list-label">{label}</span>
      {hint && <span className="tp-list-hint">{hint}</span>}
      <ChevronRight size={17} strokeWidth={1.8} aria-hidden className="tp-chevron" />
    </Link>
  );
}

export default async function MorePage() {
  const pay = await getMyPaymentSummary();

  return (
    <>
      <div className="tp-page-heading">
        <p className="tp-overline">Tu cuenta</p>
        <div>
          <h1 className="tp-h1">Más</h1>
        </div>
      </div>

      <div className="tp-card">
        <Fila
          href="/app/payments"
          label="Pagos"
          hint={pay.debtCents > 0 ? formatCurrency(pay.debtCents) : undefined}
          Icon={CreditCard}
        />
        <Fila href="/app/settings" label="Notificaciones" Icon={Bell} />
        <Fila href="/account/password" label="Contraseña" Icon={KeyRound} />
      </div>

      {/* Ayuda urgente. Los dos números son los que ya usaba la aplicación; no
          se ha añadido ningún destino nuevo. La cabecera lleva el 024 a un
          toque desde cualquier pantalla y esto es el detalle. */}
      <section className="tp-space-top" aria-labelledby="tp-ayuda">
        <div className="tp-section-heading">
          <h2 className="tp-h2" id="tp-ayuda">
            Ayuda urgente
          </h2>
        </div>
        <p className="tp-section-desc">
          Si estás en peligro o necesitas hablar con alguien ahora mismo.
        </p>
        <div
          style={{ display: "flex", gap: 10, marginTop: 16 }}
        >
          <a href="tel:024" className="tp-primary" style={{ flex: 1 }}>
            <Phone size={18} strokeWidth={1.9} aria-hidden />
            024
          </a>
          <a href="tel:112" className="tp-secondary" style={{ flex: 1 }}>
            <Phone size={18} strokeWidth={1.7} aria-hidden />
            112
          </a>
        </div>
      </section>

      {/* La entrega es solo clara. La app venía respetando la preferencia del
          sistema, así que la elección se conserva aquí en vez de forzar el
          blanco a quien abre esto de noche. */}
      <section className="tp-space-top" aria-labelledby="tp-aspecto">
        <div className="tp-section-heading">
          <h2 className="tp-h2" id="tp-aspecto">
            Aspecto
          </h2>
        </div>
        <p className="tp-section-desc">
          En claro se ve el diseño nuevo. En oscuro se usan los tonos oscuros de
          Terap.
        </p>
        <div style={{ marginTop: 14 }}>
          <ThemeToggle />
        </div>
      </section>

      <div className="tp-space-top">
        <SignOutForm />
      </div>
    </>
  );
}
