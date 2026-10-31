import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePaymentSubmission,
  samePaymentDetails,
} from "../src/lib/payment-submission";
import { paymentSchema } from "../src/lib/validation";
import { readableAudit } from "../src/lib/audit-display";

const details = {
  transactionId: "demotx123",
  sender: "01000000000",
  amount: 200,
};
const submittedAt = "2026-10-03T04:15:00.000Z";

test("simulated payment time comes from the server, ignoring supplied timestamps", () => {
  for (const paidAt of [undefined, "invalid", "2050-11-01T10:00:00.000Z"]) {
    const payment = parsePaymentSubmission(
      { ...details, paidAt, timeSource: "participant" },
      true,
      submittedAt,
    );
    assert.equal(payment.paidAt, submittedAt);
    assert.equal(payment.timeSource, "submission");
    assert.equal(payment.transactionId, "DEMOTX123");
  }
});

test("real-transfer submissions retain the required declared time and cannot claim a server timestamp", () => {
  const paidAt = "2026-10-02T03:00:00.000Z";
  const payment = parsePaymentSubmission(
    { ...details, paidAt, timeSource: "submission" },
    false,
    submittedAt,
  );
  assert.equal(payment.paidAt, paidAt);
  assert.equal(payment.timeSource, undefined);
  assert.throws(() => parsePaymentSubmission(details, false, submittedAt));
  assert.throws(() =>
    parsePaymentSubmission(
      { ...details, paidAt: "invalid" },
      false,
      submittedAt,
    ),
  );
});

test("simulated retries compare stable details while corrections and proof changes stay distinct", () => {
  const first = parsePaymentSubmission(details, true, submittedAt);
  const retry = parsePaymentSubmission(
    details,
    true,
    "2026-10-03T04:16:00.000Z",
  );
  assert.equal(samePaymentDetails(first, retry), true);
  assert.equal(
    samePaymentDetails(first, { ...retry, sender: "01000000001" }),
    false,
  );
  assert.equal(
    samePaymentDetails(first, {
      ...retry,
      proofId: "00000000-0000-4000-8000-000000000001",
    }),
    false,
  );
  assert.throws(() =>
    parsePaymentSubmission(
      { ...details, proofId: "invalid" },
      true,
      submittedAt,
    ),
  );
});

test("stored payment schema preserves legacy timestamps and new submission-time provenance", () => {
  const legacy = paymentSchema.parse({
    ...details,
    paidAt: "2026-10-02T03:00:00.000Z",
  });
  assert.equal(legacy.timeSource, undefined);
  assert.equal(legacy.paidAt, "2026-10-02T03:00:00.000Z");
  const simulated = parsePaymentSubmission(details, true, submittedAt);
  assert.deepEqual(paymentSchema.parse(simulated), simulated);
});

test("payment submission history distinguishes server-recorded simulations from declared transfers", () => {
  const simulated = parsePaymentSubmission(details, true, submittedAt);
  const view = readableAudit({
    id: "submission-audit",
    applicationId: "simulated-application",
    actor: "participant",
    action: "payment-submitted",
    before: null,
    after: simulated,
    at: submittedAt,
  });
  assert.ok(
    view.changes.some(
      (change) => change.label === "Simulation submission time",
    ),
  );
  assert.ok(
    view.changes.some((change) => change.label === "Transaction reference"),
  );
  const legacy = readableAudit({
    id: "legacy-audit",
    applicationId: "legacy-application",
    actor: "participant",
    action: "payment-submitted",
    before: null,
    after: { ...details, paidAt: submittedAt },
    at: submittedAt,
  });
  assert.ok(legacy.changes.some((change) => change.label === "Payment time"));
});
