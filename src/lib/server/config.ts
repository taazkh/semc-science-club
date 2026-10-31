import "server-only";
export function isDemo() {
  return process.env.APP_MODE === "demo";
}
export function isPreview() {
  return process.env.APP_MODE === "preview";
}
export function isTestMode() {
  return isDemo() || isPreview();
}
export function supabaseConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
export function liveEnabled() {
  return (
    !isTestMode() &&
    supabaseConfigured() &&
    process.env.LIVE_REGISTRATION_ENABLED === "true"
  );
}
export function demoAllowed() {
  const host = new URL(process.env.APP_URL || "http://127.0.0.1:3000").hostname;
  return (
    isDemo() &&
    !process.env.VERCEL &&
    !process.env.NETLIFY &&
    ["127.0.0.1", "localhost", "[::1]"].includes(host)
  );
}
