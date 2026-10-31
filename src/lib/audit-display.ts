import type { Audit, Application } from "./types";
export type AuditView = {
  id: string;
  title: string;
  actor: string;
  at: string;
  reason: string;
  changes: { label: string; before: string; after: string }[];
};
const titles: Record<string, string> = {
  "application-created": "Application created",
  "payment-submitted": "Payment details submitted",
  verify: "Payment verified",
  "reject-payment": "Payment rejected",
  approve: "Application approved",
  reject: "Application rejected",
  "email-sent": "Confirmation email marked sent",
  "review-email-sent": "Earlier review email recorded (not a confirmation)",
  correct: "Application details corrected",
  "correct-payment": "Payment details corrected",
  reconcile: "Payment amount reconciled",
};
const words: Record<string, string> = {
  not_required: "Payment not required",
  unsubmitted: "Not submitted",
  submitted: "Awaiting review",
  verified: "Verified",
  rejected: "Rejected",
  pending: "Pending",
  approved: "Approved",
  true: "Yes",
  false: "No",
};
const show = (v: unknown): string =>
  v == null || v === ""
    ? "Not recorded"
    : typeof v === "boolean"
      ? v
        ? "Yes"
        : "No"
      : words[String(v)] || String(v);
export function readableAudit(
  a: Audit,
  organisers: Record<string, string> = {},
): AuditView {
  const [action, ...reason] = a.action.split(": ");
  const before = (a.before || {}) as Partial<Application>,
    after = (
      action === "payment-submitted" && a.after
        ? { payment: a.after }
        : a.after || {}
    ) as Partial<Application>;
  const changes: AuditView["changes"] = [];
  const add = (label: string, old: unknown, next: unknown) => {
    if (JSON.stringify(old ?? null) !== JSON.stringify(next ?? null))
      changes.push({ label, before: show(old), after: show(next) });
  };
  add("Application reference", before.reference, after.reference);
  for (const [key, label] of [
    ["name", "Contact name"],
    ["email", "Contact email"],
    ["phone", "Contact phone"],
  ] as const)
    add(label, before.contact?.[key], after.contact?.[key]);
  for (const [key, label] of [
    ["paymentStatus", "Payment status"],
    ["approvalStatus", "Approval status"],
    ["total", "Total fee (BDT)"],
    ["reconciliationRequired", "Payment needs reconciliation"],
  ] as const)
    add(label, before[key], after[key]);
  const date = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) +
        " (Bangladesh time)"
      : undefined;
  add(
    "Confirmation email marked sent",
    date(before.emailSentAt),
    date(after.emailSentAt),
  );
  if (action === "review-email-sent")
    add(
      "Historical review email (not confirmation)",
      date(before.reviewEmailSentAt),
      date(after.reviewEmailSentAt),
    );
  for (const [key, label] of [
    ["amount", "Payment amount (BDT)"],
    ["sender", "Payment sender"],
    ["transactionId", "Transaction reference"],
  ] as const)
    add(label, before.payment?.[key], after.payment?.[key]);
  add(
    before.payment?.timeSource === "submission" ||
      after.payment?.timeSource === "submission"
      ? "Simulation submission time"
      : "Payment time",
    date(before.payment?.paidAt),
    date(after.payment?.paidAt),
  );
  add(
    "Screenshot attached",
    !!before.payment?.proofId,
    !!after.payment?.proofId,
  );
  const previous = before.entries || [],
    current = after.entries || [];
  for (const id of new Set([...previous, ...current].map((e) => e.segmentId))) {
    const b = previous.find((e) => e.segmentId === id),
      c = current.find((e) => e.segmentId === id),
      event = c?.segmentName || b?.segmentName || "Event";
    if (!b || !c) {
      const roster = (e: typeof b) =>
        e?.participants
          .map(
            (p) =>
              `${p.name} · ${p.school} · Class ${p.class}${p.age ? ` · Age ${p.age}` : ""}`,
          )
          .join("; ");
      add(
        `${event} — ${b ? "entry removed" : "entry added"}`,
        roster(b),
        roster(c),
      );
    } else {
      add(`${event} — team name`, b.teamName, c.teamName);
      add(`${event} — entry fee (BDT)`, b.price, c.price);
      for (
        let i = 0;
        i < Math.max(b.participants.length, c.participants.length);
        i++
      ) {
        const old = b.participants[i],
          next = c.participants[i];
        if (!old || !next)
          add(
            `${event} — participant ${i + 1} ${old ? "removed" : "added"}`,
            old?.name,
            next?.name,
          );
        else
          for (const [key, label] of [
            ["name", "name"],
            ["school", "school"],
            ["class", "class"],
            ["age", "age"],
          ] as const)
            add(
              `${event} — participant ${i + 1} ${label}`,
              old[key],
              next[key],
            );
      }
    }
  }
  return {
    id: a.id,
    title: titles[action] || "Application record updated",
    actor:
      a.actor === "participant"
        ? "Participant"
        : a.actor === "system"
          ? "System"
          : organisers[a.actor]
            ? `Organiser · ${organisers[a.actor]}`
            : "Organiser",
    at: a.at,
    reason: reason.join(": "),
    changes,
  };
}
