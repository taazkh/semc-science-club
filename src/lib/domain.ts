import type { Application, Entry, Festival, Segment } from "./types";
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
  ) {
    super(message);
  }
}
export function segmentReady(s: Segment, preview = true) {
  return (
    s.approved &&
    s.active !== false &&
    (preview || s.rulesStatus === "approved") &&
    s.kind !== "exhibition" &&
    s.fee !== null &&
    s.fee >= 0 &&
    s.classes.length > 0 &&
    !!s.rules.trim() &&
    (s.kind !== "team" ||
      (!!s.minTeam && !!s.maxTeam && s.minTeam <= s.maxTeam))
  );
}
export function festivalReady(f: Festival) {
  return (
    f.registrationOpen &&
    !!f.bkashNumber &&
    !!f.bkashInstruction &&
    !!f.contactEmail &&
    !!f.refundPolicy &&
    !!f.dates &&
    !/announce|pending|confirm/i.test(f.dates)
  );
}
export function priceEntries(
  entries: Entry[],
  segments: Segment[],
  preview = true,
): { entries: Entry[]; total: number } {
  const seen = new Set<string>();
  const priced = entries.map((e) => {
    if (seen.has(e.segmentId))
      throw new DomainError("Choose each segment only once per application.");
    seen.add(e.segmentId);
    const s = segments.find((s) => s.id === e.segmentId);
    if (!s || !segmentReady(s, preview))
      throw new DomainError("This segment is not open for registration.");
    if (s.kind === "individual" && e.participants.length !== 1)
      throw new DomainError("Individual segments require one participant.");
    if (
      s.kind === "team" &&
      (!e.teamName?.trim() ||
        e.participants.length < s.minTeam! ||
        e.participants.length > s.maxTeam!)
    )
      throw new DomainError("Check the team name and permitted roster size.");
    if (e.participants.some((p) => !s.classes.includes(p.class)))
      throw new DomainError("A participant is outside the eligible classes.");
    if (
      s.minAge &&
      e.participants.some((p) => !Number.isInteger(p.age) || p.age! < s.minAge!)
    )
      throw new DomainError(
        `${s.name} requires participants to be at least ${s.minAge}.`,
      );
    const identities = e.participants.map((p) =>
      [
        p.name.trim().toLowerCase(),
        p.school.trim().toLowerCase(),
        p.class,
      ].join("|"),
    );
    if (new Set(identities).size !== identities.length)
      throw new DomainError("A roster contains the same participant twice.");
    return { ...e, segmentName: s.name, kind: s.kind, price: s.fee! };
  });
  return { entries: priced, total: priced.reduce((n, e) => n + e.price!, 0) };
}
export function transition(
  a: Application,
  action: string,
  payload: Record<string, unknown>,
): Application {
  const next = structuredClone(a);
  if (action === "verify") {
    if (!a.payment || a.paymentStatus === "unsubmitted")
      throw new DomainError("Payment details are required.");
    if (a.payment.amount !== a.total)
      throw new DomainError(
        "Payment amount and total must match before verification.",
      );
    next.paymentStatus = "verified";
    next.reconciliationRequired = false;
  } else if (action === "reject-payment") {
    if (!a.payment) throw new DomainError("No payment to reject.");
    next.paymentStatus = "rejected";
    next.approvalStatus = "pending";
    next.emailSentAt = null;
  } else if (action === "approve") {
    if (
      (a.paymentStatus !== "verified" &&
        !(a.total === 0 && a.paymentStatus === "not_required")) ||
      a.reconciliationRequired
    )
      throw new DomainError(
        "Verify and reconcile payment before approving the application.",
      );
    next.approvalStatus = "approved";
  } else if (action === "reject") {
    next.approvalStatus = "rejected";
    next.emailSentAt = null;
  } else if (action === "email-sent") {
    if (
      a.approvalStatus !== "approved" ||
      a.reconciliationRequired ||
      (a.paymentStatus !== "verified" &&
        !(a.total === 0 && a.paymentStatus === "not_required"))
    )
      throw new DomainError(
        "Approve the application before recording its confirmation.",
      );
    next.emailSentAt = a.emailSentAt || new Date().toISOString();
  } else if (action === "correct-payment") {
    if (!String(payload.reason || "").trim())
      throw new DomainError("A correction reason is required.");
    next.payment = {
      ...(payload.payment as NonNullable<Application["payment"]>),
      ...(a.payment?.proofId ? { proofId: a.payment.proofId } : {}),
    };
    next.paymentStatus = "submitted";
    next.approvalStatus = "pending";
    next.emailSentAt = null;
    next.reconciliationRequired = next.payment!.amount !== next.total;
  } else if (action === "reconcile") {
    if (
      !a.payment ||
      !String(payload.reason || "").trim() ||
      payload.effectiveAmount !== a.total
    )
      throw new DomainError(
        "Record the verified net amount and reconciliation evidence.",
      );
    next.paymentStatus = "verified";
    next.reconciliationRequired = false;
  } else if (action === "correct") {
    if (!String(payload.reason || "").trim())
      throw new DomainError("A correction reason is required.");
    const correction = payload.correction as Partial<Application>;
    if (correction.contact) next.contact = correction.contact;
    if (correction.entries) {
      next.entries = correction.entries;
      next.total = correction.total!;
      next.approvalStatus = "pending";
      next.emailSentAt = null;
      if (next.total !== a.total) {
        next.reconciliationRequired = !!a.payment;
        next.paymentStatus = a.payment
          ? "submitted"
          : next.total === 0
            ? "not_required"
            : "unsubmitted";
        if (!a.payment) {
          next.submittedAt = next.total === 0 ? new Date().toISOString() : null;
          next.reviewDueAt =
            next.total === 0
              ? new Date(Date.now() + 172800000).toISOString()
              : null;
        }
      }
    }
  } else throw new DomainError("Unknown review action.");
  return next;
}

export function priceCorrection(
  entries: Entry[],
  segments: Segment[],
  previous: Entry[],
) {
  const seen = new Set<string>();
  const priced = entries.map((entry) => {
    if (seen.has(entry.segmentId))
      throw new DomainError("Choose each segment only once.");
    seen.add(entry.segmentId);
    const old = previous.find((p) => p.segmentId === entry.segmentId);
    const unchanged =
      old &&
      JSON.stringify(old.participants) === JSON.stringify(entry.participants) &&
      (old.teamName || "") === (entry.teamName || "");
    if (unchanged)
      return {
        ...entry,
        segmentName: old.segmentName,
        kind: old.kind,
        price: old.price!,
      };
    const fresh = priceEntries([entry], segments).entries[0];
    if (old && old.kind !== fresh.kind)
      throw new DomainError(
        "The segment format has changed. Reconcile its format with the owner before changing this entry.",
      );
    return old ? { ...fresh, price: old.price! } : fresh;
  });
  return {
    entries: priced,
    total: priced.reduce((sum, e) => sum + e.price!, 0),
  };
}
