import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import programme from "../src/lib/teacher-content.json";
import {
  expandSoloEntries,
  readRegistrationDraft,
  soloEligibilityIssues,
  soloProfiles,
  blankParticipant,
} from "../src/lib/registration-draft";
import {
  groupSegments,
  programmeCategories,
} from "../src/lib/programme-groups";
import { priceEntries } from "../src/lib/domain";
import type { Entry, Segment } from "../src/lib/types";

const segments = programme.segments as Segment[];
test("blank participants and old sample drafts contain no assumed personal details", () => {
  assert.deepEqual(blankParticipant(), {name: "", school: "", class: 0});
  const raw = JSON.stringify({idempotencyKey: randomUUID(), token: "a".repeat(64),
    contact: {name: "Sample Participant", email: "participant@example.test", phone: "01000000000"},
    solo: {name: "Sample Participant", school: "Fictional Sample School", class: 8, age: 15},
    entries: [{segmentId: "project-display", teamName: "Sample Team", participants: [
      {name: "Sample Teammate 1", school: "Fictional Sample School", class: 8, age: 15},
      {name: "User Entered Name", school: "User Entered School", class: 9, age: 14},
    ]}],
  });
  const draft = readRegistrationDraft(raw, true);
  assert.deepEqual(draft.contact, {name: "", email: "", phone: ""});
  assert.equal(draft.solo?.class, 0);
  assert.equal(draft.solo?.age, undefined);
  assert.equal(draft.entries?.[0].teamName, "");
  assert.equal(draft.entries?.[0].participants[0].name, "");
  assert.equal(draft.entries?.[0].participants[1].name, "User Entered Name");
  assert.equal(draft.entries?.[0].participants[1].class, 9);
  assert.equal(readRegistrationDraft(JSON.stringify(draft), true).solo?.name, "");
  assert.equal(readRegistrationDraft(raw).contact?.name, "Sample Participant");
});
const participant = {
  name: "Fictional Student",
  school: "Test School",
  class: 8,
  age: 15,
};
const solo = (segmentId: string): Entry => ({
  segmentId,
  participants: [{ ...participant }],
});
const team: Entry = {
  segmentId: "project-display",
  teamName: "Test Team",
  participants: Array.from({ length: 4 }, (_, i) => ({
    ...participant,
    name: `Teammate ${i + 1}`,
  })),
};

test("shared solo edits reach every selected solo event without changing team rosters or prices", () => {
  const original = [
    solo("math-olympiad"),
    team,
    solo("physics-olympiad"),
    solo("clash-royale-tournament"),
  ];
  const updated = { ...participant, name: "Changed Student", class: 9 };
  const entries = expandSoloEntries(original, segments, updated);
  assert.deepEqual(
    entries
      .filter((e) => e.segmentId !== team.segmentId)
      .map((e) => e.participants),
    [[updated], [updated], [updated]],
  );
  assert.deepEqual(entries[1], team);
  assert.equal(original[0].participants[0].name, participant.name);
  assert.equal(priceEntries(entries, segments, true).total, 400);
  assert.equal(
    priceEntries(
      expandSoloEntries([solo("clash-royale-tournament")], segments, updated),
      segments,
      true,
    ).total,
    0,
  );
});

test("eligibility conflicts identify each affected event and preserve selections", () => {
  const selected = segments.filter((s) =>
    [
      "programming-contest",
      "clash-royale-tournament",
      "math-olympiad",
    ].includes(s.id),
  );
  const issues = soloEligibilityIssues(
    { ...participant, class: 5, age: 12 },
    selected,
  );
  assert.equal(issues.length, 3);
  assert.ok(issues.some((i) => i.includes("Programming Contest")));
  assert.ok(issues.some((i) => i.includes("age 13")));
  assert.equal(selected.length, 3);
  assert.deepEqual(soloEligibilityIssues(participant, selected), []);
});

test("legacy drafts retain conflicting profiles, while one shared profile is recognised", () => {
  const entries = [solo("math-olympiad"), solo("physics-olympiad"), team];
  assert.equal(soloProfiles(entries, segments).length, 1);
  entries[1].participants[0].name = "Different Student";
  const draft = readRegistrationDraft(
    JSON.stringify({
      entries,
      idempotencyKey: randomUUID(),
      token: "a".repeat(64),
      consent: true,
    }),
  );
  assert.equal(soloProfiles(draft.entries!, segments).length, 2);
  assert.equal(draft.solo, undefined);
  assert.equal(draft.entries![1].participants[0].name, "Different Student");
});

test("incomplete shared drafts restore safely; malformed saved credentials are rejected", () => {
  const draft = {
    entries: [],
    solo: { name: "", school: "", class: 8 },
    idempotencyKey: randomUUID(),
    token: "a".repeat(64),
  };
  assert.deepEqual(
    readRegistrationDraft(JSON.stringify(draft)).solo,
    draft.solo,
  );
  assert.throws(() =>
    readRegistrationDraft(JSON.stringify({ ...draft, token: "invalid" })),
  );
  assert.throws(() => readRegistrationDraft("invalid JSON"));
});

test("all 17 events group consistently, and future categories are not hidden", () => {
  const groups = groupSegments([...segments].reverse());
  assert.deepEqual(
    groups.map((g) => g.category),
    [...programmeCategories],
  );
  assert.equal(groups.flatMap((g) => g.segments).length, 17);
  assert.equal(groups[0].segments[0].id, "project-display");
  const custom = { ...segments[0], id: "new-event", category: "New category" };
  const extended = groupSegments([...segments, custom]);
  assert.equal(extended.at(-1)!.segments[0].id, "new-event");
});
