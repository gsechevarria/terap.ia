import Link from "next/link";
import {
  CreditCard,
  Bell,
  KeyRound,
  Phone,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { getMyPaymentSummary } from "@/lib/queries/payments";
import { formatCurrency } from "@/lib/format";
import { SignOutForm } from "@/components/SignOutForm";

export const metadata = { title: "Más · terap.ia" };

function Row({
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
    <Link
      href={href}
      className="row-hover flex items-center gap-3 px-4 py-3.5 text-sm"
    >
      <Icon className="size-4 shrink-0 text-ink-2" strokeWidth={2} aria-hidden />
      <span className="font-medium">{label}</span>
      {hint && <span className="ml-auto text-ink-2">{hint}</span>}
      <ChevronRight
        className={`size-4 shrink-0 text-ink-3 ${hint ? "" : "ml-auto"}`}
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}

export default async function MorePage() {
  const pay = await getMyPaymentSummary();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Más</h1>

      <section className="card divide-y divide-line">
        <Row
          href="/app/payments"
          label="Pagos"
          hint={pay.debtCents > 0 ? formatCurrency(pay.debtCents) : undefined}
          Icon={CreditCard}
        />
        <Row href="/app/settings" label="Notificaciones" Icon={Bell} />
        <Row href="/account/password" label="Contraseña" Icon={KeyRound} />
      </section>

      <section>
        <h2 className="section-label mb-2">Ayuda urgente</h2>
        <div className="card flex flex-col gap-2 p-4">
          <p className="text-sm text-ink-2">
            Si estás en peligro o necesitas hablar con alguien ahora mismo:
          </p>
          <div className="flex gap-2">
            <a href="tel:024" className="btn-danger btn-lg flex-1">
              <Phone className="size-4" strokeWidth={2.25} aria-hidden />
              024
            </a>
            <a href="tel:112" className="btn-subtle btn-lg flex-1">
              <Phone className="size-4" strokeWidth={2} aria-hidden />
              112
            </a>
          </div>
        </div>
      </section>

      <SignOutForm />
    </div>
  );
}
