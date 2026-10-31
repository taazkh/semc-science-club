import test from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import {
  verifyAccessCode,
  signAccess,
  validAccess,
  safeReturnPath,
  TEST_ACCESS_SECONDS,
} from "../src/lib/access-token";
import {
  idleExpired,
  idleRemaining,
  ADMIN_IDLE_MS,
} from "../src/lib/admin-idle";
import { readableAudit } from "../src/lib/audit-display";
import { transition } from "../src/lib/domain";
import type { Application } from "../src/lib/types";
test("shared code, expiry, tampering, missing secret and rotation fail closed", () => {
  const salt = "test-salt",
    code = "Only-a-test",
    secret = "s".repeat(48),
    now = 1_000_000;
  const hash = salt + ":" + scryptSync(code, salt, 32).toString("hex");
  assert.equal(verifyAccessCode(code, hash), true);
  assert.equal(verifyAccessCode("wrong", hash), false);
  assert.equal(verifyAccessCode(code, ""), false);
  const signed = signAccess(now + TEST_ACCESS_SECONDS * 1000, secret);
  assert.equal(validAccess(signed, now, secret), true);
  assert.equal(
    validAccess(signed, now + TEST_ACCESS_SECONDS * 1000, secret),
    false,
  );
  for (const [value, key] of [
    [signed + "a", secret],
    [signed, "rotated".repeat(8)],
    [signed, ""],
  ])
    assert.equal(validAccess(value, now, key), false);
  assert.equal(
    validAccess(signAccess(now + 8 * 86400000, secret), now, secret),
    false,
  );
});
test("return paths cannot redirect outside the site or include recovery fragments", () => {
  for (const path of [
    "https://bad.test",
    "//bad.test",
    "/\\bad.test",
    "/access",
    "/status#secret",
  ])
    assert.equal(safeReturnPath(path), "/");
  assert.equal(safeReturnPath("/status"), "/status");
});
test("inactivity clocks expire at five minutes including sleep jumps", () => {
  const start = 1000,
    end = start + ADMIN_IDLE_MS;
  assert.equal(idleRemaining(end, start), 300);
  assert.equal(idleRemaining(end, start + 240000), 60);
  assert.equal(idleExpired(end, end - 1), false);
  assert.equal(idleExpired(end, end), true);
  assert.equal(idleRemaining(end, end + 86400000), 0);
});
test("confirmation is idempotent and cannot use legacy review email markers", () => {
  const a = {
    approvalStatus: "approved",
    paymentStatus: "not_required",
    total: 0,
    emailSentAt: null,
    reviewEmailSentAt: "2020-01-01T00:00:00Z",
    reconciliationRequired: false,
  } as Application;
  const sent = transition(a, "email-sent", {});
  assert.ok(sent.emailSentAt);
  assert.equal(sent.reviewEmailSentAt, a.reviewEmailSentAt);
  assert.equal(
    transition(sent, "email-sent", {}).emailSentAt,
    sent.emailSentAt,
  );
  assert.throws(() => transition(a, "review-email-sent", {}));
  assert.throws(() =>
    transition({ ...a, paymentStatus: "submitted" }, "email-sent", {}),
  );
});
test("history allows only readable application fields and explains roster changes", () => {
  const person = { name: "Fictional Student", school: "Test school", class: 8 };
  const view = readableAudit({
    id: "audit",
    applicationId: "private-id",
    actor: "raw-admin-id",
    action: "correct: Requested a roster correction",
    at: "2026-09-27T00:00:00Z",
    before: {
      tokenHash: "secret-hash",
      payment: { proofId: "storage-path" },
      entries: [
        {
          segmentId: "math",
          segmentName: "Mathematics",
          participants: [person],
        },
      ],
    },
    after: { tokenHash: "changed-hash", entries: [] },
  });
  assert.equal(view.actor, "Organiser");
  assert.equal(view.title, "Application details corrected");
  assert.match(
    view.changes.map((c) => c.label).join(" "),
    /Mathematics — entry removed/,
  );
  for (const secret of [
    "secret-hash",
    "changed-hash",
    "storage-path",
    "raw-admin-id",
    "private-id",
  ])
    assert.ok(!JSON.stringify(view).includes(secret));
});
