import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { isDemo } from "./config";
import { db, readDoc, saveDoc, transaction } from "./demo-db";
import { service } from "./supabase";
import { ADMIN_IDLE_MS, idleExpired } from "../admin-idle";
import { DomainError } from "../domain";
const COOKIE = "semc-admin-session";
type Session = { userId: string; expiresAt: number };
async function tokenHash() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token && /^[a-f0-9]{64}$/.test(token)
    ? createHash("sha256").update(token).digest("hex")
    : null;
}
export async function beginAdminSession(userId: string) {
  await endAdminSession();
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  let expiresAt = Date.now() + ADMIN_IDLE_MS;
  if (isDemo()) saveDoc("admin-session", hash, { userId, expiresAt });
  else {
    const { data, error } = await service().rpc("start_admin_session", {
      p_actor: userId,
      p_hash: hash,
    });
    if (error || !data)
      throw new DomainError(
        "Administrator session could not start. Please contact the owner.",
        503,
      );
    expiresAt = Date.parse(data);
  }
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith("https://"),
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return expiresAt;
}
export async function adminSessionExpiry(userId: string, touch = false) {
  const hash = await tokenHash();
  if (!hash) return null;
  if (isDemo())
    return transaction(() => {
      const row = readDoc<Session>("admin-session", hash);
      if (!row || row.userId !== userId || idleExpired(row.expiresAt))
        return null;
      if (touch) {
        row.expiresAt = Date.now() + ADMIN_IDLE_MS;
        saveDoc("admin-session", hash, row);
      }
      return row.expiresAt;
    });
  if (touch) {
    const { data, error } = await service().rpc("touch_admin_session", {
      p_actor: userId,
      p_hash: hash,
    });
    if (error)
      throw new DomainError(
        "Could not check the administrator session. Please sign in again.",
        503,
      );
    return data ? Date.parse(data) : null;
  }
  const { data, error } = await service()
    .from("admin_sessions")
    .select("expires_at")
    .eq("token_hash", hash)
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new DomainError(
      "Could not check the administrator session. Please sign in again.",
      503,
    );
  const expires = data ? Date.parse(data.expires_at) : 0;
  return idleExpired(expires) ? null : expires;
}
export async function endAdminSession() {
  const hash = await tokenHash();
  if (hash) {
    if (isDemo())
      db()
        .prepare("DELETE FROM documents WHERE kind='admin-session' AND id=?")
        .run(hash);
    else {
      const { error } = await service()
        .from("admin_sessions")
        .delete()
        .eq("token_hash", hash);
      if (error)
        throw new DomainError(
          "Could not close the administrator session. Please retry.",
          503,
        );
    }
  }
  (await cookies()).delete(COOKIE);
}
