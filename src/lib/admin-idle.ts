export const ADMIN_IDLE_MS = 5 * 60 * 1000;
export const ADMIN_WARNING_MS = 60 * 1000;
export function idleExpired(expiresAt: number, now = Date.now()) {
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}
export function idleRemaining(expiresAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}
