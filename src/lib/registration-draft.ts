import { z } from "zod";
import type { Entry, Person, Segment } from "./types";

const draftPerson = z.object({
  name: z.string().max(100),
  school: z.string().max(180),
  class: z.union([z.literal(0), z.number().int().min(3).max(12)]),
  age: z.number().min(0).max(30).optional(),
});
const draftSchema = z.object({
  idempotencyKey: z.uuid(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  entries: z
    .array(
      z.object({
        segmentId: z.string().max(80),
        teamName: z.string().max(100).optional(),
        participants: z.array(draftPerson).min(1).max(12),
      }),
    )
    .max(18)
    .optional(),
  contact: z
    .object({
      name: z.string().max(100),
      email: z.string().max(180),
      phone: z.string().max(30),
    })
    .optional(),
  consent: z.boolean().optional(),
  solo: draftPerson.optional(),
});

export function blankParticipant(): Person {
  return { name: "", school: "", class: 0 };
}

export function readRegistrationDraft(raw: string, clearSamples = false) {
  const draft = draftSchema.parse(JSON.parse(raw));
  if (!clearSamples) return draft;
  const clean = (p: Person): Person => {
    const sample = /^(Sample Participant|Sample Teammate \d+)$/.test(p.name);
    return {
      ...p,
      name: sample ? "" : p.name,
      school: p.school === "Fictional Sample School" ? "" : p.school,
      class: sample ? 0 : p.class,
      age: sample ? undefined : p.age,
    };
  };
  if (draft.contact) {
    if (draft.contact.name === "Sample Participant") draft.contact.name = "";
    if (draft.contact.email === "participant@example.test") draft.contact.email = "";
    if (draft.contact.phone === "01000000000") draft.contact.phone = "";
  }
  if (draft.solo) draft.solo = clean(draft.solo);
  draft.entries = draft.entries?.map(e => ({ ...e,
    teamName: e.teamName === "Sample Team" ? "" : e.teamName,
    participants: e.participants.map(clean),
  }));
  return draft;
}

/** Older drafts can have distinct solo participants. Never silently choose one. */
export function soloProfiles(entries: Entry[], segments: Segment[]): Person[] {
  const soloIds = new Set(
    segments.filter((s) => s.kind === "individual").map((s) => s.id),
  );
  const people = entries
    .filter((e) => soloIds.has(e.segmentId))
    .flatMap((e) => e.participants);
  return [
    ...new Map(
      people.map((p) => [
        JSON.stringify([
          p.name.trim(),
          p.school.trim(),
          p.class,
          p.age ?? null,
        ]),
        p,
      ]),
    ).values(),
  ];
}

/** Existing API and database continue to receive one participant snapshot per event. */
export function expandSoloEntries(
  entries: Entry[],
  segments: Segment[],
  solo: Person,
): Entry[] {
  const soloIds = new Set(
    segments.filter((s) => s.kind === "individual").map((s) => s.id),
  );
  return entries.map((entry) =>
    soloIds.has(entry.segmentId)
      ? { ...entry, participants: [{ ...solo }] }
      : entry,
  );
}

export function soloEligibilityIssues(
  solo: Person,
  selected: Segment[],
): string[] {
  return selected.flatMap((segment) => {
    if (segment.kind !== "individual") return [];
    const issues: string[] = [];
    if (solo.class && !segment.classes.includes(solo.class)) {
      issues.push(
        `${segment.name} is not open to Class ${solo.class}. Eligible classes: ${segment.classes.join(", ")}.`,
      );
    }
    if (
      segment.minAge &&
      (solo.age === undefined || solo.age < segment.minAge)
    ) {
      issues.push(
        `${segment.name} requires age ${segment.minAge} or older on the event date.`,
      );
    }
    return issues;
  });
}
