"use client";
import { StatusTimeline } from "./status-timeline";
import { notify } from "./feedback-toast";
import { useState, useEffect } from "react";
import type { Application, Festival } from "@/lib/types";
import { PaymentForm, PaymentProofViewer } from "./payment-form";
import { api } from "@/lib/client-api";
import { money } from "@/lib/catalog";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import { CheckCircleIcon, LockKeyIcon, EnvelopeIcon } from "./icons";
import { CopyConfirm } from "./copy-confirm";
import { BusyIndicator } from "./busy-indicator";
import { LiquidGlassSurface } from "./liquid-glass-surface";
import { ChangingValue } from "./editorial-motion";
export function StatusView({
  festival,
  demo,
  paymentPage = false,
}: {
  festival: Festival;
  demo: boolean;
  paymentPage?: boolean;
}) {
  const [reference, setReference] = useState(""),
    [token, setToken] = useState(""),
    [application, setApplication] = useState<Application | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [link, setLink] = useState("");
  async function load(ref: string, key: string, refreshing = false) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ application: Application }>("/api/status", {
        reference: ref,
        token: key,
      });
      setApplication(result.application);
      if (refreshing) notify("Application status refreshed.", "success");
      setLink(window.location.origin + "/status#" + ref + ":" + key);
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const [ref, key] = window.location.hash.slice(1).split(":");
    if (ref && key) {
      setReference(ref);
      setToken(key);
      void load(ref, key);
    }
  }, []);
  if (!application)
    return (
      <section className="shell narrow-form">
        <LockKeyIcon size={32} />
        <h1 style={{ fontSize: "2.5rem", marginTop: 20 }}>
          Your application,
          <br />
          kept private.
        </h1>
        <p>
          Open your saved private link, or enter your reference and retrieval
          key below. A reference number alone cannot access a registration.
        </p>
        <form
          className="form-panel"
          data-material="glass"
          onSubmit={(e) => {
            e.preventDefault();
            void load(reference, token);
          }}
        >
          <LiquidGlassSurface strength={16} />
          <Field label="Registration reference">
            <Input
              required
              value={reference}
              onChange={(e) =>
                setReference(e.target.value.trim().toUpperCase())
              }
              placeholder="SEMC-26-…"
            />
          </Field>
          <Field label="Private retrieval key">
            <Input
              required
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              autoComplete="off"
            />
          </Field>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <Button disabled={busy} type="submit">
            {busy ? (
              <BusyIndicator label="Opening…" state="searching" />
            ) : (
              "Open application"
            )}
          </Button>
        </form>
      </section>
    );
  const a = application;
  return (
    <section className="shell section">
      <div className="status-header">
        <CheckCircleIcon size={38} />
        <div>
          <h1>
            {paymentPage && !a.payment && a.total > 0
              ? "Complete your payment step"
              : a.reference}
          </h1>
          <p>
            {demo
              ? "Test application saved. No event place is reserved and no money should be sent."
              : "Application saved. Approval is still required."}
          </p>
        </div>
      </div>
      {demo && (
        <div className="notice">
          <strong>Test application.</strong> No real payments or registrations
          are being accepted.
        </div>
      )}
      {(a.payment || a.paymentStatus === "not_required") && (
        <div className="notice">
          <strong>Confirmation follows successful review.</strong>
          <p>
            {demo
              ? "Organisers can send a test confirmation email after approval. This does not reserve a festival place."
              : "Organisers check the application before confirming your place."}
          </p>
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-success" role="status">
          {message}
        </div>
      )}
      <div className="status-grid">
        <div>
          <div className="form-panel" data-material="glass">
            <LiquidGlassSurface strength={18} />
            <h2>Save your recovery link before leaving this page.</h2>
            <p>
              Anyone with this link can view your application. Save it somewhere
              private.
            </p>
            <div className="field">
              <label htmlFor="private-link">Private retrieval link</label>
              <div className="secret-link">
                <Input
                  id="private-link"
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                />
                <CopyConfirm key={link} value={link} onResult={setMessage} />
              </div>
            </div>
          </div>
          <div className="form-panel">
            <PaymentProofViewer
              application={a}
              reference={reference}
              token={token}
            />
            <h2>Application details</h2>
            <h3>{a.contact.name}</h3>
            <p>
              {a.contact.email}
              <br />
              {a.contact.phone}
            </p>
            {a.entries.map((e) => (
              <div className="roster" key={e.segmentId}>
                <h3>{e.segmentName}</h3>
                {e.teamName && <p>{e.teamName}</p>}
                {e.participants.map((p, i) => (
                  <p key={i}>
                    {p.name}
                    <br />
                    <small>
                      {p.school} · Class {p.class}
                      {p.age ? ` · Age ${p.age}` : ""}
                    </small>
                  </p>
                ))}
                <p>
                  {money(e.price || 0)}{" "}
                  {e.kind === "team" ? "per team" : "per person"}
                </p>
              </div>
            ))}
            <div className="summary-total">
              <span>Total</span>
              <ChangingValue value={money(a.total)} />
            </div>
          </div>
        </div>
        <div>
          <div className="form-panel">
            <h2>Where things stand</h2>
            <StatusTimeline application={a} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => load(reference, token, true)}
              disabled={busy}
            >
              {busy ? (
                <BusyIndicator label="Refreshing…" state="searching" />
              ) : (
                "Refresh status"
              )}
            </Button>
          </div>
          {!a.payment && a.total > 0 ? (
            paymentPage ? (
              <PaymentForm
                application={a}
                reference={reference}
                token={token}
                festival={festival}
                demo={demo}
              />
            ) : (
              <div className="notice">
                <h2>Payment details are still needed</h2>
                <p>
                  Your application is saved. Continue to payment to submit it
                  for review.
                </p>
                <Button asChild>
                  <a href={"/payment#" + reference + ":" + token}>
                    Continue to payment
                  </a>
                </Button>
              </div>
            )
          ) : (
            <div className="notice">
              {a.total === 0
                ? "Payment not required."
                : "Payment details are saved."}{" "}
              For any correction
              {a.reconciliationRequired ? " or fee reconciliation" : ""},
              contact the organisers with your registration reference.{" "}
              {festival.contactEmail && (
                <a href={"mailto:" + festival.contactEmail}>
                  {festival.contactEmail}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
