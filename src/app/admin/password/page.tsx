import { AdminSessionTimer } from "@/components/admin-session-timer";
import { getAdmin } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/login-form";
export const dynamic = "force-dynamic";
export default async function Password() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login?error=invite");
  return (
    <div className="admin-shell">
      <div className="shell">
        <AdminSessionTimer initialExpiresAt={admin.expiresAt!} />
      </div>
      <PasswordForm />
    </div>
  );
}
