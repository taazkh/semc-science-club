"use client";
import { FileAttachment } from "./file-attachment";
import { useEffect, useState } from "react";
import type { Application, Festival } from "@/lib/types";
import { api } from "@/lib/client-api";
import { money } from "@/lib/catalog";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import { BusyIndicator } from "./busy-indicator";
import { feedbackAfterNavigation, notify } from "./feedback-toast";
import { CopyConfirm } from "./copy-confirm";
import { LiquidGlassSurface } from "./liquid-glass-surface";
import { motion, useReducedMotion } from "motion/react";

export function PaymentProofViewer({
  application,
  reference,
  token,
  admin = false,
}: {
  application: Application;
  reference?: string;
  token?: string;
  admin?: boolean;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!application.payment?.proofId) return null;
  return (
    <div>
      <Button
        variant="secondary"
        type="button"
        disabled={busy}
        onClick={async () => {
          if (url) {
            setUrl("");
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = await api<{ url: string }>("/api/payment/proof", {
              action: admin ? "admin-view" : "view",
              applicationId: application.id,
              reference,
              token,
              proofId: application.payment?.proofId,
            });
            setUrl(result.url);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Opening…"
          : url
            ? "Hide screenshot"
            : "View private screenshot"}
      </Button>
      {error && <p role="alert">{error}</p>}
      {url && (
        <img
          src={url}
          alt="Submitted payment screenshot"
          style={{
            maxWidth: "100%",
            maxHeight: 700,
            objectFit: "contain",
            marginTop: 16,
          }}
        />
      )}
    </div>
  );
}

export function PaymentForm({
  application,
  reference,
  token,
  festival,
  demo,
}: {
  application: Application;
  reference: string;
  token: string;
  festival: Festival;
  demo: boolean;
}) {
  const [payment, setPayment] = useState({
    transactionId: "",
    sender: "",
    paidAt: "",
  });
  const [file, setFile] = useState<File | null>(null),
    [proofId, setProofId] = useState("");
  const reduced = useReducedMotion();
  const [filePreview, setFilePreview] = useState("");
  useEffect(() => {
    if (
      !file ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setFilePreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  useEffect(() => {
    const saved = sessionStorage.getItem("semc-payment-" + reference);
    if (saved) {
      try {
        const value = JSON.parse(saved);
        setPayment({
          transactionId:
            typeof value.payment?.transactionId === "string"
              ? value.payment.transactionId
              : "",
          sender:
            typeof value.payment?.sender === "string"
              ? value.payment.sender
              : "",
          paidAt:
            !demo && typeof value.payment?.paidAt === "string"
              ? value.payment.paidAt
              : "",
        });
        setProofId(value.proofId || "");
        if (demo || value.payment?.paidAt) return;
      } catch {}
    }
    setPayment((p) => ({
      ...p,
      paidAt: demo
        ? ""
        : new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16),
    }));
  }, [reference, demo]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    let readyId = proofId;
    try {
      sessionStorage.setItem(
        "semc-payment-" + reference,
        JSON.stringify({ payment, proofId: readyId }),
      );
      if (file && !readyId) {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error(
            "Choose a PNG, JPEG or WebP screenshot no larger than 5 MB.",
          );
        setProgress("Uploading screenshot…");
        const prepared = await api<{
          proofId: string;
          uploadUrl: string;
          local: boolean;
        }>("/api/payment/proof", {
          action: "prepare",
          reference,
          token,
          mime: file.type,
          size: file.size,
        });
        const response = await fetch(prepared.uploadUrl, {
          method: prepared.local ? "POST" : "PUT",
          headers: prepared.local
            ? {
                "Content-Type": file.type,
                "x-registration-reference": reference,
                "x-retrieval-key": token,
                "x-proof-id": prepared.proofId,
              }
            : { "Content-Type": file.type, "x-upsert": "false" },
          body: file,
        });
        if (!response.ok)
          throw new Error(
            "Screenshot upload was interrupted. Your application is saved; please retry.",
          );
        setProgress("Checking screenshot…");
        await api("/api/payment/proof", {
          action: "finalize",
          reference,
          token,
          proofId: prepared.proofId,
        });
        readyId = prepared.proofId;
        setProofId(readyId);
        sessionStorage.setItem(
          "semc-payment-" + reference,
          JSON.stringify({ payment, proofId: readyId }),
        );
      }
      if (application.proofRequired && !readyId)
        throw new Error("Please attach the payment screenshot.");
      setProgress("Submitting for review…");
      await api("/api/payment", {
        reference,
        token,
        payment: {
          transactionId: payment.transactionId,
          sender: payment.sender,
          ...(!demo ? { paidAt: new Date(payment.paidAt).toISOString() } : {}),
          amount: application.total,
          ...(readyId ? { proofId: readyId } : {}),
        },
      });
      sessionStorage.removeItem("semc-payment-" + reference);
      feedbackAfterNavigation(
        "Payment details submitted for organiser review. They are not verified yet.",
      );
      window.location.assign("/status#" + reference + ":" + token);
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <div className="form-panel" data-material="glass">
      <LiquidGlassSurface strength={18} />
      <h2>{demo ? "Simulate a payment" : "Pay with bKash"}</h2>
      {demo ? (
        <div className="notice">
          <strong>Test only — never send money.</strong>
          <p>
            Use a made-up transaction ID and the sample screenshot. No bKash
            recipient is used for testing.
          </p>
          <a className="text-link" href="/assets/sample-payment.png" download>
            Download a sample test screenshot
          </a>
        </div>
      ) : (
        <>
          <p style={{ whiteSpace: "pre-line" }}>
            {festival.bkashInstruction ||
              "Payment instructions are not configured."}
          </p>
          <p>
            Recipient:{" "}
            <strong>{festival.bkashNumber || "Not yet configured"}</strong>
            {festival.bkashNumber && (
              <CopyConfirm
                value={festival.bkashNumber}
                label="Copy recipient"
                success="Recipient number copied."
                fallback="Select the recipient number and copy it manually."
              />
            )}
          </p>
        </>
      )}
      <p>
        Total: <strong>{money(application.total)}</strong>
        {demo ? " (simulation only)" : ""}
      </p>
      <form onSubmit={submit}>
        <Field
          label={demo ? "Synthetic transaction ID" : "bKash transaction ID"}
        >
          <Input
            required
            minLength={6}
            maxLength={30}
            pattern="[A-Za-z0-9]{6,30}"
            value={payment.transactionId}
            onChange={(e) =>
              setPayment({
                ...payment,
                transactionId: e.target.value.toUpperCase(),
              })
            }
          />
        </Field>
        <Field label={demo ? "Test sender number" : "Sender’s bKash number"}>
          <Input
            required
            type="tel"
            pattern="[+0-9 ]{8,20}"
            value={payment.sender}
            onChange={(e) => setPayment({ ...payment, sender: e.target.value })}
          />
        </Field>
        {demo ? (
          <p className="fine-print">
            The server records when you submit this simulation. This is a
            submission time, not a bank transfer time.
          </p>
        ) : (
          <Field label="Payment date and time">
            <Input
              required
              type="datetime-local"
              value={payment.paidAt}
              onChange={(e) =>
                setPayment({ ...payment, paidAt: e.target.value })
              }
            />
          </Field>
        )}
        <FileAttachment
          label={demo ? "Sample screenshot" : "Payment screenshot"}
          file={file}
          preview={filePreview}
          saved={!!proofId}
          required={!!application.proofRequired}
          busy={busy}
          onChange={(value) => {
            setFile(value);
            setProofId("");
          }}
        />
        <p className="fine-print">
          PNG, JPEG or WebP, up to 5 MB.{" "}
          {proofId
            ? "Your screenshot is saved; no need to upload again."
            : "Only you and authorised organisers can view it."}{" "}
          Screenshots do not automatically verify payments. Never share a PIN or
          OTP.
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {progress && (
          <p>
            <BusyIndicator label={progress} />
          </p>
        )}
        <Button
          disabled={
            busy ||
            (!demo && (!festival.bkashNumber || !festival.bkashInstruction))
          }
        >
          {busy
            ? "Please wait…"
            : demo
              ? "Submit test payment"
              : "Submit payment details"}
        </Button>
        <p>After submission, contact organisers for corrections.</p>
      </form>
    </div>
  );
}
