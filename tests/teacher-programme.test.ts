import test from "node:test";
import assert from "node:assert/strict";
import { programmeSegments, initialMembers } from "../src/lib/catalog";
import { priceEntries, segmentReady, transition } from "../src/lib/domain";
import type { Entry, Application, Segment } from "../src/lib/types";
const entry = (s: Segment): Entry => ({
  segmentId: s.id,
  ...(s.kind === "team" ? { teamName: "Test team" } : {}),
  participants: Array.from({ length: s.minTeam || 1 }, (_, i) => ({
    name: `Test Person ${i}`,
    school: "Fictional school",
    class: 8,
    age: 15,
  })),
});
test("17 actual event fees, exact team formats and live draft lock", () => {
  assert.equal(programmeSegments.length, 17);
  assert.deepEqual(
    programmeSegments.map((s) => s.fee),
    [
      200, 100, 100, 100, 100, 100, 100, 200, 200, 200, 100, 0, 100, 100, 100,
      100, 100,
    ],
  );
  for (const s of programmeSegments) {
    assert.equal(priceEntries([entry(s)], programmeSegments).total, s.fee);
    assert.equal(segmentReady(s, false), false);
    if (s.kind === "team") {
      assert.equal(s.minTeam, s.maxTeam);
      const wrong = entry(s);
      wrong.participants.pop();
      assert.throws(() => priceEntries([wrong], programmeSegments));
    }
  }
});
test("Clash requires both senior class and age 13; free-only approval needs no payment", () => {
  const s = programmeSegments.find((s) => s.id === "clash-royale-tournament")!;
  const e = entry(s);
  e.participants[0].age = 12;
  assert.throws(() => priceEntries([e], programmeSegments));
  e.participants[0].age = 15;
  e.participants[0].class = 7;
  assert.throws(() => priceEntries([e], programmeSegments));
  e.participants[0].class = 8;
  const a = {
    ...priceEntries([e], programmeSegments),
    paymentStatus: "not_required",
    approvalStatus: "pending",
    reconciliationRequired: false,
  } as Application;
  assert.equal(transition(a, "approve", {}).approvalStatus, "approved");
  assert.equal(
    priceEntries([e, entry(programmeSegments[0])], programmeSegments).total,
    200,
  );
});
test("council members preserve supplied names and role ordering without fabricated media", () => {
  const council = initialMembers.filter(
    (member) => member.group === "Student council",
  );
  assert.equal(council.length, 13);
  assert.equal(council[0].title, "Saheel Wazir Mamun");
  assert.equal(council[5].title, "Shayonto Choudhury");
  assert.equal(council[12].title, "Ayman Hassan");
  assert.ok(council.every((m, i) => m.position === i && !m.image && !m.body));
});
test("member seeds contain only the student council, independent of Home quotes", () => {
  assert.equal(initialMembers.length, 13);
  assert.ok(initialMembers.every((member) => member.group === "Student council"));
});
