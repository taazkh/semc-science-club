import "server-only";
import { isDemo, isPreview, demoAllowed, supabaseConfigured } from "./config";
import { service } from "./supabase";
import { readDoc } from "./demo-db";
import { DomainError } from "../domain";

export async function environmentSettings() {
  if (isDemo()) {
    if (!demoAllowed())
      throw new DomainError(
        "Local demonstration is unavailable on this host.",
        403,
      );
    const setting = readDoc<{ mode: string; registrationEnabled: boolean }>(
      "settings",
      "environment",
    );
    return {
      mode: "preview",
      registrationEnabled:
        setting?.mode === "preview" && setting.registrationEnabled,
    };
  }
  if (!supabaseConfigured())
    throw new DomainError("Supabase is not configured.", 503);
  const { data, error } = await service()
    .from("deployment_settings")
    .select("mode,registration_enabled")
    .eq("id", 1)
    .single();
  const expected = isPreview()
    ? "preview"
    : process.env.APP_MODE === "production"
      ? "production"
      : "disabled";
  if (error || !data || expected === "disabled" || data.mode !== expected)
    throw new DomainError(
      "Website and database environments do not match. Ask the owner to check setup.",
      503,
    );
  return {
    mode: data.mode as string,
    registrationEnabled: data.registration_enabled === true,
  };
}
