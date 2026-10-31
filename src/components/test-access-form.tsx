"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import { api } from "@/lib/client-api";
export function TestAccessForm({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="shell narrow-form">
      <h1>A first look at STEMfest.</h1>
      <p>
        Enter the shared access code from the organisers to explore the website.
      </p>
      <form
        className="form-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/api/test-access", { action: "enter", code });
            window.location.replace(next + window.location.hash);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <Field label="Shared access code">
          <Input
            type="password"
            required
            maxLength={128}
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <p>
          Use fictional participant and payment details. Testing does not
          reserve a place. Never send money.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button disabled={busy}>{busy ? "Checking…" : "Enter website"}</Button>
      </form>
    </section>
  );
}
export function LeaveTestAccess() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await api("/api/test-access", { action: "leave" });
            window.location.assign("/access");
          } catch {
            setError(
              "Could not leave test access. Check your connection and retry.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Leave test access
      </Button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
