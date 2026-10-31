"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import { api } from "@/lib/client-api";
import { ShieldCheckIcon } from "./icons";
import { LiquidGlassSurface } from "./liquid-glass-surface";
import { notify, feedbackAfterNavigation } from "./feedback-toast";
export function LoginForm({
  demo,
  expired = false,
}: {
  demo: boolean;
  expired?: boolean;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(
        "/api/auth",
        demo ? { action: "demo" } : { action: "login", email, password },
      );
      feedbackAfterNavigation("Signed in to the organiser workspace.");
      window.location.assign("/admin");
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message, "error");
      setBusy(false);
    }
  }
  return (
    <section className="shell narrow-form">
      <ShieldCheckIcon size={36} />
      <h1 style={{ fontSize: "2.7rem", marginTop: 24 }}>
        Behind the festival.
      </h1>
      <p>Individual sign-in for authorised organisers.</p>
      {expired && (
        <p className="notice" role="status">
          Signed out after five minutes of inactivity.
        </p>
      )}
      <form
        className="form-panel"
        onSubmit={submit}
        aria-busy={busy}
        data-material="glass"
      >
        <LiquidGlassSurface strength={16} />
        {demo ? (
          <>
            <span className="demo-label">Local demonstration</span>
            <p style={{ marginTop: 20 }}>
              Explore the organiser workspace with synthetic records. This
              access cannot manage real registrations or invite real
              administrators.
            </p>
          </>
        ) : (
          <>
            <Field label="Administrator email">
              <Input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <p className="fine-print">
              Access is invite-only. Contact the owner if you need an invitation
              or password recovery.
            </p>
          </>
        )}
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : demo ? "Enter demo workspace" : "Sign in"}
        </Button>
      </form>
    </section>
  );
}
export function PasswordForm() {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="shell narrow-form">
      <h1 style={{ fontSize: "2.5rem" }}>Set your password.</h1>
      <form
        className="form-panel"
        data-material="glass"
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (password !== confirm) {
            setError("Passwords do not match.");
            return;
          }
          setBusy(true);
          try {
            await api("/api/auth", { action: "set-password", password });
            feedbackAfterNavigation(
              "Password saved. Your organiser workspace is ready.",
            );
            window.location.assign("/admin");
          } catch (e) {
            setError((e as Error).message);
            notify((e as Error).message, "error");
            setBusy(false);
          }
        }}
      >
        <LiquidGlassSurface strength={16} />
        <Field label="New password">
          <Input
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field
          label="Confirm password"
          error={error === "Passwords do not match." ? error : undefined}
        >
          <Input
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button disabled={busy}>Save password</Button>
      </form>
    </section>
  );
}
