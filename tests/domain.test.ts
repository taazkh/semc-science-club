import test from "node:test";
import assert from "node:assert/strict";
import {
  priceEntries,
  transition,
  festivalReady,
  segmentReady,
} from "../src/lib/domain";
import { demoSegments, initialFestival } from "../src/lib/catalog";
import { registrationSchema, paymentSchema } from "../src/lib/validation";
import type { Application, Entry } from "../src/lib/types";
const one = { name: "Test Student", school: "Test School", class: 8 };
const entries: Entry[] = [
  { segmentId: "demo-math", participants: [one] },
  {
    segmentId: "demo-project",
    teamName: "Test Team",
    participants: [one, { ...one, name: "Another Student" }],
  },
];
const app = (): Application => ({
  id: "00000000-0000-4000-8000-000000000001",
  reference: "DEMO-TEST",
  createdAt: new Date().toISOString(),
  contact: {
    name: "Test Student",
    email: "test@example.test",
    phone: "01000000000",
  },
  ...priceEntries(entries, demoSegments),
  paymentStatus: "unsubmitted",
  approvalStatus: "pending",
  emailSentAt: null,
  reconciliationRequired: false,
});
test("individual and team fees produce one combined total, without multiplying team fee", () => {
  assert.equal(priceEntries(entries, demoSegments).total, 800);
  const extra = structuredClone(entries);
  extra[1].participants.push({ ...one, name: "Third Student" });
  assert.equal(priceEntries(extra, demoSegments).total, 800);
});
test("browser supplied prices cannot change server total", () => {
  assert.equal(
    priceEntries(
      entries.map((e) => ({ ...e, price: 1 })),
      demoSegments,
    ).total,
    800,
  );
});
test("missing eligibility, fee and approved rules close a segment", () => {
  for (const change of [
    { fee: null },
    { classes: [] },
    { rules: "" },
    { approved: false },
  ])
    assert.equal(segmentReady({ ...demoSegments[0], ...change }), false);
  assert.equal(festivalReady(initialFestival), false);
});
test("duplicates and invalid rosters are refused", () => {
  assert.throws(() => priceEntries([entries[0], entries[0]], demoSegments));
  assert.throws(() =>
    priceEntries([{ ...entries[1], participants: [one, one] }], demoSegments),
  );
  assert.throws(() =>
    priceEntries([{ ...entries[1], participants: [one] }], demoSegments),
  );
  assert.throws(() =>
    priceEntries(
      [
        {
          ...entries[1],
          participants: [one, { ...one, name: "Younger", class: 3 }],
        },
      ],
      demoSegments,
    ),
  );
});
test("approval requires independently verified payment and email marking requires approval", () => {
  const a = app();
  assert.throws(() => transition(a, "approve", {}));
  assert.throws(() => transition(a, "email-sent", {}));
  assert.throws(() => transition(a, "verify", {}));
  a.payment = {
    transactionId: "DEMOABC123",
    sender: "01000000000",
    amount: 800,
    paidAt: new Date().toISOString(),
  };
  a.paymentStatus = "submitted";
  const approved = transition(transition(a, "verify", {}), "approve", {});
  assert.equal(approved.approvalStatus, "approved");
  assert.equal(approved.emailSentAt, null);
  assert.ok(transition(approved, "email-sent", {}).emailSentAt);
});
test("fee-changing corrections reset approval and require reconciliation", () => {
  const a = app();
  a.paymentStatus = "verified";
  a.approvalStatus = "approved";
  a.payment = {
    transactionId: "DEMOTEST1",
    sender: "01000000000",
    amount: 800,
    paidAt: new Date().toISOString(),
  };
  const after = transition(a, "correct", {
    reason: "Remove team entry",
    correction: priceEntries([entries[0]], demoSegments),
  });
  assert.equal(after.total, 200);
  assert.equal(after.approvalStatus, "pending");
  assert.equal(after.reconciliationRequired, true);
  assert.throws(() => transition(after, "approve", {}));
  assert.throws(() => transition(after, "verify", {}));
});
test("server schemas reject malformed data and normalise transaction IDs", () => {
  assert.equal(
    paymentSchema.parse({
      transactionId: "abc12345",
      sender: "01000000000",
      amount: 800,
      paidAt: new Date().toISOString(),
    }).transactionId,
    "ABC12345",
  );
  assert.throws(() => paymentSchema.parse({ transactionId: "a", amount: 800 }));
  assert.throws(() =>
    registrationSchema.parse({ contact: { email: "bad" }, entries }),
  );
});

test("unchanged entries retain price snapshots during organiser corrections, even after a segment closes", async () => {
  const { priceCorrection } = await import("../src/lib/domain");
  const original = priceEntries(entries, demoSegments);
  assert.equal(
    priceCorrection(
      entries,
      demoSegments.map((s) => ({ ...s, fee: 999 })),
      original.entries,
    ).total,
    800,
  );
  assert.equal(priceCorrection(entries, [], original.entries).total, 800);
  const edited = structuredClone(entries);
  edited[0].participants[0].name = "Corrected Student";
  assert.equal(
    priceCorrection(
      edited,
      demoSegments.map((s) => ({ ...s, fee: 999 })),
      original.entries,
    ).total,
    800,
  );
});
