// Build and run the complete redesign without loading connected service settings.
import {
  cpSync,
  existsSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
  rmSync,
  readFileSync,
  statSync,
} from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { spawn } from "node:child_process";
const mode = process.argv[2] || "dev";
if (!["prepare", "dev", "build", "start"].includes(mode))
  throw new Error("Use prepare, dev, build or start.");
const target = resolve("test-results/redesign-preview");
if (mode !== "start") {
  mkdirSync(target, { recursive: true });
  for (const name of [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
    "next-env.d.ts",
  ])
    if (existsSync(name))
      cpSync(name, resolve(target, name), {
        recursive: true,
        filter: (source, destination) =>
          statSync(source).isDirectory() ||
          !existsSync(destination) ||
          !readFileSync(source).equals(readFileSync(destination)),
      });
  // Additive copying must discard retired source and stale generated dev types.
  // Only contained source/cache paths are removed; local records stay intact.
  for (const name of [
    "src/app/updates",
    "src/lib/club-teachers.json",
    "public/images/members",
    "public/images/placeholders/anonymous-profile.webp",
    "public/review/portrait-options.html",
    ...[
      "md-easin-arfat", "md-mahabub-alam", "mohammad-amjad-hossain",
      "monjur-hossain-chowdhury", "rumana-sharmin-sumi", "sultan-mahmud",
      "shahana-sultana", "lubna-akter", "md-assaduzzaman",
    ].map((id) => `public/images/members/${id}.webp`),
    ...[
      "src/components/theme-toggle.tsx",
      "src/components/background-motion-toggle.tsx",
      "src/lib/redesign/background-preference.ts",
    ].filter((name) => !existsSync(name)),
    ...(mode === "build" ? [".next/dev/types"] : []),
  ]) {
    const retiredPath = resolve(target, name);
    const retiredRelative = relative(target, retiredPath);
    if (retiredRelative.startsWith("..") || isAbsolute(retiredRelative))
      throw new Error("Retired paths must stay inside the isolated preview.");
    if (existsSync(retiredPath))
      rmSync(retiredPath, { recursive: true, force: true });
  }
  if (!existsSync(resolve(target, "node_modules")))
    symlinkSync(
      resolve("node_modules"),
      resolve(target, "node_modules"),
      "junction",
    );
  writeFileSync(
    resolve(target, ".env.local"),
    "APP_MODE=demo\nAPP_URL=http://127.0.0.1:3004\nALLOW_LOCAL_DEMO=true\nLIVE_REGISTRATION_ENABLED=false\nTEST_ACCESS_REQUIRED=false\nPUBLIC_RELEASE_STATE=preview\n",
  );
}
if (mode !== "prepare") {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /SUPABASE|TEST_ACCESS|^APP_MODE$|^APP_URL$|^VERCEL|^LIVE_REGISTRATION|^PUBLIC_RELEASE_STATE$/.test(
        key,
      )
    )
      delete env[key];
  const args =
    mode === "build"
      ? ["build", "--webpack"]
      : [mode, "--hostname", "127.0.0.1", "--port", "3004"];
  const child = spawn(
    process.execPath,
    [resolve("node_modules/next/dist/bin/next"), ...args],
    { cwd: target, env, stdio: "inherit" },
  );
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
