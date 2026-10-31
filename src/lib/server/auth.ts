import "server-only";
import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { isDemo, demoAllowed, supabaseConfigured } from "./config";
import { db } from "./demo-db";
import { service, sessionClient } from "./supabase";
import { DomainError } from "../domain";
import { environmentSettings } from "./environment";
import type { Admin, Role } from "../types";
import { adminSessionExpiry, endAdminSession } from "./admin-session";
function demoSignature(v: string) {
  let row = db()
    .prepare("SELECT value FROM secrets WHERE key='session'")
    .get() as { value: string } | undefined;
  if (!row) {
    db()
      .prepare("INSERT OR IGNORE INTO secrets VALUES(?,?)")
      .run("session", randomBytes(32).toString("hex"));
    row = db()
      .prepare("SELECT value FROM secrets WHERE key='session'")
      .get() as { value: string };
  }
  return createHmac("sha256", row.value).update(v).digest("hex");
}
export async function startDemoSession() {
  if (!demoAllowed())
    throw new DomainError(
      "Demonstration sign-in is available only in the local preview.",
      403,
    );
  const expires = String(Date.now() + 8 * 60 * 60 * 1000);
  (await cookies()).set("semc-demo", expires + "." + demoSignature(expires), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}
export async function getAuthenticatedAdmin(): Promise<Admin | null> {
  if (isDemo()) {
    if (!demoAllowed()) return null;
    const val = (await cookies()).get("semc-demo")?.value;
    if (!val) return null;
    const [stamp, signature] = val.split(".");
    if (!signature || !/^\d+$/.test(stamp) || Number(stamp) < Date.now())
      return null;
    const expected = demoSignature(stamp);
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return null;
    return {
      id: "00000000-0000-4000-8000-000000000001",
      email: "local-organiser@example.test",
      role: "owner",
    };
  }
  if (!supabaseConfigured()) return null;
  await environmentSettings();
  const client = await sessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  const { data } = await service()
    .from("admin_permissions")
    .select("role")
    .eq("user_id", user.id)
    .eq("active", true)
    .single();
  return data
    ? { id: user.id, email: user.email || "", role: data.role as Role }
    : null;
}
export async function getAdmin(): Promise<Admin | null> {
  const admin = await getAuthenticatedAdmin();
  if (!admin) return null;
  const expiresAt = await adminSessionExpiry(admin.id);
  return expiresAt ? { ...admin, expiresAt } : null;
}
export async function requireAdmin(
  roles: Role[] = ["owner", "organiser", "editor"],
) {
  const admin = await getAdmin();
  if (!admin)
    throw new DomainError(
      "Your administrator session has ended. Please sign in again.",
      401,
      "ADMIN_SESSION_EXPIRED",
    );
  if (!roles.includes(admin.role))
    throw new DomainError(
      "Your account does not have permission for this action.",
      403,
    );
  return admin;
}
export async function signOut() {
  await endAdminSession();
  if (isDemo()) (await cookies()).delete("semc-demo");
  else if (supabaseConfigured())
    await (await sessionClient()).auth.signOut({ scope: "local" });
}
