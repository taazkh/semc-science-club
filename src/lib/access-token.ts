import { createHmac, timingSafeEqual, scryptSync } from "node:crypto";

export const TEST_COOKIE = "semc-test-access";
export const TEST_ACCESS_SECONDS = 7 * 24 * 60 * 60;
export function testAccessRequired() {
  return process.env.TEST_ACCESS_REQUIRED === "true";
}
export function accessConfigured() {
  return (
    !!process.env.TEST_ACCESS_CODE_HASH &&
    (process.env.TEST_ACCESS_SESSION_SECRET?.length || 0) >= 32
  );
}
function equal(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export function verifyAccessCode(
  code: string,
  verifier = process.env.TEST_ACCESS_CODE_HASH || "",
) {
  const [salt, hash] = verifier.split(":");
  if (!salt || !/^[a-f0-9]{64}$/.test(hash || "") || code.length > 128)
    return false;
  return equal(scryptSync(code.trim(), salt, 32).toString("hex"), hash);
}
export function signAccess(
  expires: number,
  secret = process.env.TEST_ACCESS_SESSION_SECRET || "",
) {
  const stamp = String(expires);
  return stamp + "." + createHmac("sha256", secret).update(stamp).digest("hex");
}
export function validAccess(
  value?: string,
  now = Date.now(),
  secret = process.env.TEST_ACCESS_SESSION_SECRET || "",
) {
  if (!value || secret.length < 32) return false;
  const [stamp, signature, extra] = value.split(".");
  if (extra || !/^\d+$/.test(stamp) || !/^[a-f0-9]{64}$/.test(signature || ""))
    return false;
  const expires = Number(stamp);
  return (
    expires > now &&
    expires <= now + TEST_ACCESS_SECONDS * 1000 &&
    equal(value, signAccess(expires, secret))
  );
}
export function safeReturnPath(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\r\n#]/.test(value) &&
    !value.startsWith("/access")
    ? value
    : "/";
}
