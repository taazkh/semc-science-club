import { redirect } from "next/navigation";
import { getAdmin, getAuthenticatedAdmin } from "@/lib/server/auth";
import { isDemo, isTestMode } from "@/lib/server/config";
import { AdminWorkspace } from "@/components/admin-workspace";
export const metadata = { title: "Organiser workspace" };
export const dynamic = "force-dynamic";
export default async function Admin() {
  const admin = await getAdmin();
  if (!admin)
    redirect(
      (await getAuthenticatedAdmin())
        ? "/admin/login?reason=inactive"
        : "/admin/login",
    );
  return (
    <AdminWorkspace admin={admin} demo={isDemo()} testMode={isTestMode()} />
  );
}
