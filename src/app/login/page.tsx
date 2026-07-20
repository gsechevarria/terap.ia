import Link from "next/link";
import { LoginForm } from "@/app/login/LoginForm";
import { Brandmark } from "@/components/ui/Brandmark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="inline-flex items-center">
        <Brandmark height={64} />
      </Link>
      <LoginForm invite={invite} />
    </main>
  );
}
