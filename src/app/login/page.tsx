import Link from "next/link";
import { LoginForm } from "@/app/login/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Link
        href="/"
        className="inline-flex items-baseline gap-1 text-lg font-semibold tracking-[-0.01em] text-ink"
      >
        terap.ia
        <span aria-hidden className="size-1.5 self-center rounded-full bg-accent" />
      </Link>
      <LoginForm invite={invite} />
    </main>
  );
}
