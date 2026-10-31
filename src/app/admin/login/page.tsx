import { demoAllowed } from "@/lib/server/config";
import { LoginForm } from "@/components/login-form";
export const metadata = { title: "Organiser sign-in" };
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  return (
    <LoginForm
      demo={demoAllowed()}
      expired={(await searchParams).reason === "inactive"}
    />
  );
}
