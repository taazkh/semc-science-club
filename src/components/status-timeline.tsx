"use client";
import { motion, useReducedMotion } from "motion/react";
import type { Application } from "@/lib/types";
import StatusMark from "./react-bits/status-mark";
export function StatusTimeline({
  application: a,
}: {
  application: Application;
}) {
  const reduced = useReducedMotion();
  const rows = [
    {
      id: "saved",
      state: a.createdAt,
      title: "Application received",
      detail: new Date(a.createdAt).toLocaleDateString("en-GB"),
      done: true,
      failed: false,
    },
    {
      id: "payment",
      state: a.paymentStatus,
      title:
        a.paymentStatus === "not_required"
          ? "No payment required"
          : a.paymentStatus === "verified"
            ? "Payment verified"
            : a.paymentStatus === "rejected"
              ? "Payment needs correction"
              : a.payment
                ? "Payment details submitted"
                : "Payment details needed",
      detail:
        a.paymentStatus === "rejected"
          ? "Contact organisers to correct the payment details."
          : a.paymentStatus === "verified"
            ? "Organisers have verified the payment details."
            : a.payment
              ? "Received for organiser verification."
              : a.total === 0
                ? "This application contains free events only."
                : "Continue to the payment step when ready.",
      done:
        a.paymentStatus === "verified" || a.paymentStatus === "not_required",
      failed: a.paymentStatus === "rejected",
    },
    {
      id: "review",
      state: `${a.approvalStatus}-${a.reconciliationRequired}`,
      title:
        a.approvalStatus === "approved"
          ? "Application approved"
          : a.approvalStatus === "rejected"
            ? "Application not approved"
            : a.reconciliationRequired
              ? "Correction review needed"
              : a.payment || a.total === 0
                ? "Awaiting organiser review"
                : "Review follows payment submission",
      detail: a.reconciliationRequired
        ? "Organisers must reconcile the revised fees."
        : "Your whole application is reviewed together.",
      done: a.approvalStatus === "approved",
      failed: a.approvalStatus === "rejected",
    },
    {
      id: "email",
      state: a.emailSentAt || "pending",
      title: a.emailSentAt
        ? "Confirmation marked sent"
        : "Confirmation not yet marked sent",
      detail: a.emailSentAt
        ? `Manually recorded ${new Date(a.emailSentAt).toLocaleString("en-GB")}. This is not a delivery receipt.`
        : "Organisers send it manually after approval.",
      done: !!a.emailSentAt,
      failed: false,
    },
  ];
  return (
    <ol className="status-stages status-timeline">
      {rows.map(({ id, state, title, detail, done, failed }) => (
        <motion.li
          key={`${id}-${state}`}
          data-complete={done}
          initial={reduced !== false ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced !== false ? 0 : 0.24 }}
        >
          <span aria-hidden="true">
            <StatusMark
              status={failed ? "failed" : done ? "done" : "pending"}
              size={24}
              strike={false}
            />
          </span>
          <div>
            <strong>{title}</strong>
            <small>{detail}</small>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
