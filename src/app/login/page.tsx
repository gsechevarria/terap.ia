import { LoginForm } from "@/app/login/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <LoginForm invite={invite} />
    </main>
  );
}
