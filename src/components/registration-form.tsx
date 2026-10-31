"use client";
import { useEffect, useState, useRef } from "react";
import type { Application, Entry, Person, Segment } from "@/lib/types";
import { money } from "@/lib/catalog";
import { segmentReady } from "@/lib/domain";
import { api } from "@/lib/client-api";
import { groupSegments } from "@/lib/programme-groups";
import {
  expandSoloEntries,
  readRegistrationDraft,
  soloEligibilityIssues,
  soloProfiles,
  blankParticipant,
} from "@/lib/registration-draft";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import { AnimatedCheckbox } from "./ui/animated-checkbox";
import { SpringCheckbox } from "./react-bits/spring-check";
import { MeasuredSummary } from "./measured-summary";
import "./registration-interactions.css";
import { AnimatedDropdown } from "./ui/animated-dropdown";
import { feedbackAfterNavigation, notify } from "./feedback-toast";
import { LiquidGlassSurface } from "./liquid-glass-surface";
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  PlusIcon,
  MinusIcon,
  LockKeyIcon,
} from "./icons";
import { RegistrationProgress } from "./registration-progress";
import { BusyIndicator } from "./busy-indicator";
import { ChangingValue } from "./editorial-motion";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function RegistrationForm({
  segments,
  demo,
  rehearsal = false,
}: {
  segments: Segment[];
  demo: boolean;
  rehearsal?: boolean;
}) {
  const reduced = useReducedMotion();
  const draftStorageKey = rehearsal
    ? "semc-rehearsal-submission"
    : "semc-submission";
  const formRef = useRef<HTMLFormElement>(null),
    previousStep = useRef(0);
  const [step, setStep] = useState(0),
    [direction, setDirection] = useState(1),
    [quote, setQuote] = useState<{ entries: Entry[]; total: number } | null>(
      null,
    ),
    [draftEntries, setEntries] = useState<Entry[]>([]),
    [solo, setSolo] = useState<Person>(blankParticipant),
    [legacyProfiles, setLegacyProfiles] = useState<Person[]>([]),
    [restored, setRestored] = useState(false),
    [storageWarning, setStorageWarning] = useState(""),
    [contact, setContact] = useState({
      name: "",
      email: "",
      phone: "",
    }),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(""),
    [token, setToken] = useState(""),
    [honeypot, setHoneypot] = useState("");
  useEffect(() => {
    let recovered = false;
    try {
      const saved = sessionStorage.getItem(draftStorageKey);
      if (saved) {
        const v = readRegistrationDraft(saved, demo);
        setKey(v.idempotencyKey);
        setToken(v.token);
        recovered = true;
        if (v.entries) {
          setEntries(v.entries);
          if (v.contact) setContact(v.contact);
          setConsent(v.consent ?? false);
          const profiles = soloProfiles(v.entries, segments);
          if (v.solo) setSolo(v.solo);
          else if (profiles.length === 1) setSolo(profiles[0]);
          else if (profiles.length > 1) setLegacyProfiles(profiles);
          if (v.entries.length) setStep(1);
        }
      }
    } catch {
      setStorageWarning(
        "Your saved draft could not be restored. You can start again below. If you already saved an application, use its private recovery link.",
      );
    }
    if (!recovered) {
      setKey(crypto.randomUUID());
      setToken(newToken());
    }
    setRestored(true);
  }, [segments, demo, draftStorageKey]);
  const entries = legacyProfiles.length
    ? draftEntries
    : expandSoloEntries(draftEntries, segments, solo);
  const selected = groupSegments(
    segments.filter((s) => entries.some((e) => e.segmentId === s.id)),
  ).flatMap((group) => group.segments);
  const soloSegments = selected.filter((s) => s.kind === "individual");
  const teamEntries = selected
    .filter((s) => s.kind === "team")
    .map((s) => entries.find((e) => e.segmentId === s.id)!);
  const missingEntries = entries.filter(
    (e) => !segments.some((s) => s.id === e.segmentId),
  );
  const eligibilityIssues = soloEligibilityIssues(solo, soloSegments);
  const requiresAge = soloSegments.some((s) => s.minAge);
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          idempotencyKey: key,
          token,
          entries: legacyProfiles.length
            ? draftEntries
            : expandSoloEntries(draftEntries, segments, solo),
          contact,
          consent,
          solo: legacyProfiles.length ? undefined : solo,
        }),
      );
    } catch {
      setStorageWarning(
        "This browser cannot save your draft. Keep this tab open until you have saved your application and copied its private recovery link.",
      );
    }
  }, [
    restored,
    key,
    token,
    draftEntries,
    contact,
    consent,
    solo,
    legacyProfiles,
    segments,
    draftStorageKey,
  ]);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const heading = formRef.current?.querySelector("h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "start" });
    }
  }, [step]);
  const navigateStep = (next: number) => {
    setDirection(next >= step ? 1 : -1);
    setStep(next);
  };
  const available = segments.filter((s) => segmentReady(s, demo));
  const total =
    step === 2 && quote
      ? quote.total
      : entries.reduce(
          (sum, e) =>
            sum + (segments.find((s) => s.id === e.segmentId)?.fee || 0),
          0,
        );
  const blank = blankParticipant;
  function toggle(s: Segment) {
    setEntries((old) =>
      old.some((e) => e.segmentId === s.id)
        ? old.filter((e) => e.segmentId !== s.id)
        : [
            ...old,
            {
              segmentId: s.id,
              teamName: s.kind === "team" ? "" : undefined,
              participants: Array.from(
                { length: s.kind === "team" ? s.minTeam! : 1 },
                () => blank(),
              ),
            },
          ],
    );
  }
  function updateEntry(id: string, fn: (e: Entry) => Entry) {
    setEntries((old) => old.map((e) => (e.segmentId === id ? fn(e) : e)));
  }
  function personChange(
    id: string,
    index: number,
    key: keyof Person,
    value: string | number,
  ) {
    updateEntry(id, (e) => ({
      ...e,
      participants: e.participants.map((p, i) =>
        i === index ? { ...p, [key]: value } : p,
      ),
    }));
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (step === 0) {
      if (!entries.length) {
        setError("Choose at least one segment.");
        return;
      }
      navigateStep(1);
      return;
    }
    if (step === 1) {
      if (legacyProfiles.length && soloSegments.length) {
        setError(
          "Choose which saved participant to use for all solo events before continuing.",
        );
        return;
      }
      if (missingEntries.length) {
        setError(
          "Remove the unavailable events shown below before continuing.",
        );
        return;
      }
      if (eligibilityIssues.length) {
        setError(
          eligibilityIssues.join(" ") +
            " Check the participant details or go back to change your events.",
        );
        return;
      }
      setBusy(true);
      try {
        const result = await api<{ entries: Entry[]; total: number }>(
          rehearsal
            ? "/api/rehearsal/registration/quote"
            : "/api/registration/quote",
          { entries },
        );
        setQuote(result);
        navigateStep(2);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!consent) {
      setError(
        "Please confirm that these details can be used for registration.",
      );
      return;
    }
    setBusy(true);
    const payload = {
      contact,
      entries,
      idempotencyKey: key,
      token,
      consent,
      website: honeypot,
      expectedTotal: quote?.total,
    };
    try {
      sessionStorage.setItem(draftStorageKey, JSON.stringify(payload));
    } catch {
      /* Submission still works without browser storage. */
    }
    try {
      const { application } = await api<{ application: Application }>(
        rehearsal ? "/api/rehearsal/registration" : "/api/registration",
        payload,
      );
      try {
        sessionStorage.removeItem(draftStorageKey);
      } catch {
        /* The private link is authoritative. */
      }
      feedbackAfterNavigation(
        "Application saved. Keep your private recovery link safe.",
      );
      window.location.assign(
        (application.total === 0 ? "/status#" : "/payment#") +
          application.reference +
          ":" +
          token,
      );
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message, "error");
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <RegistrationProgress
        step={step}
        onChange={(next) => {
          navigateStep(next);
          setError("");
        }}
        busy={busy}
      />
      <div className="form-layout" style={{ marginTop: 28 }}>
        <form ref={formRef} onSubmit={submit} aria-busy={busy}>
          {storageWarning && <p role="status">{storageWarning}</p>}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <input
            className="hidden-trap"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            name="website"
          />
          <motion.div
            className="wizard-stage"
            key={step}
            initial={
              reduced !== false ? false : { opacity: 0.25, x: 18 * direction }
            }
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduced !== false ? 0 : 0.22 }}
          >
            {step === 0 && (
              <div className="form-panel">
                <h2>What sparks your curiosity?</h2>
                <p>
                  Choose one or more segments. Team fees cover the whole team.
                </p>
                {groupSegments(available).map((group) => (
                  <fieldset
                    className="registration-category"
                    key={group.category}
                  >
                    <legend>{group.category}</legend>
                    {group.segments.map((s) => (
                      <label className="choice-row" key={s.id}>
                        <SpringCheckbox
                          type="checkbox"
                          checked={entries.some((e) => e.segmentId === s.id)}
                          onChange={() => toggle(s)}
                        />
                        <span>
                          <strong>{s.name}</strong>
                          <small>
                            {s.kind === "team"
                              ? `Exactly ${s.minTeam} members`
                              : "Individual"}{" "}
                            · Classes {s.classes.join(", ")}
                          </small>
                          <small>
                            {s.minAge ? `Age ${s.minAge}+ required. ` : ""}
                            <a
                              href={"/stemfest/" + s.id}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Read draft rules
                            </a>
                          </small>
                        </span>
                        <span className="price">{money(s.fee!)}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                {available.length === 0 && <p>No segments are open yet.</p>}
              </div>
            )}
            {step === 1 && (
              <>
                <div className="form-panel">
                  <h2>Who should we contact?</h2>
                  <p>
                    This person will receive the organisers’ confirmation email.
                  </p>
                  <div className="field-grid">
                    <Field label="Contact name">
                      <Input
                        required
                        minLength={2}
                        maxLength={100}
                        autoComplete="name"
                        value={contact.name}
                        onChange={(e) =>
                          setContact({ ...contact, name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Email address">
                      <Input
                        required
                        type="email"
                        maxLength={180}
                        autoComplete="email"
                        value={contact.email}
                        onChange={(e) =>
                          setContact({ ...contact, email: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Phone number">
                      <Input
                        required
                        type="tel"
                        pattern="[+0-9 ]{8,20}"
                        autoComplete="tel"
                        value={contact.phone}
                        onChange={(e) =>
                          setContact({ ...contact, phone: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
                {missingEntries.map((entry) => (
                  <div className="form-panel" key={entry.segmentId}>
                    <h2>Unavailable event</h2>
                    <p>
                      The saved event “{entry.segmentId}” is no longer listed.
                      Other selections and participant details have been kept.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setEntries((old) =>
                          old.filter((e) => e.segmentId !== entry.segmentId),
                        )
                      }
                    >
                      Remove unavailable event
                    </Button>
                  </div>
                ))}
                {soloSegments.length > 0 && (
                  <div className="form-panel">
                    <h2>Solo participant</h2>
                    <p>Enter these details once for all your solo events:</p>
                    <ul>
                      {soloSegments.map((s) => (
                        <li key={s.id}>{s.name}</li>
                      ))}
                    </ul>
                    {legacyProfiles.length > 0 ? (
                      <>
                        <p role="alert">
                          Your older draft contains different solo participants.
                          Choose one profile to use for every selected solo
                          event. Your team rosters will stay unchanged.
                        </p>
                        <Field label="Which saved participant should we use?">
                          <AnimatedDropdown
                            label="Which saved participant should we use?"
                            value=""
                            required
                            onChange={(value) => {
                              if (value === "") return;
                              setSolo({
                                ...legacyProfiles[Number(value)],
                              });
                              setLegacyProfiles([]);
                              setError("");
                            }}
                            options={[
                              {
                                value: "",
                                label: "Choose a saved participant",
                                disabled: true,
                              },
                              ...legacyProfiles.map((p, i) => ({
                                value: String(i),
                                label: `${p.name || "Unnamed participant"} · ${p.school || "School not entered"} · Class ${p.class}${p.age !== undefined ? ` · Age ${p.age}` : ""}`,
                              })),
                            ]}
                          />
                        </Field>
                      </>
                    ) : (
                      <>
                        <div className="field-grid">
                          <Field label="Participant full name">
                            <Input
                              required
                              minLength={2}
                              maxLength={100}
                              value={solo.name}
                              onChange={(e) =>
                                setSolo({ ...solo, name: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="Participant school or college">
                            <Input
                              required
                              minLength={2}
                              maxLength={180}
                              value={solo.school}
                              onChange={(e) =>
                                setSolo({ ...solo, school: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="Participant class">
                            <AnimatedDropdown
                              label="Participant class"
                              required
                              value={solo.class ? String(solo.class) : ""}
                              onChange={(value) =>
                                setSolo({
                                  ...solo,
                                  class: Number(value),
                                })
                              }
                              options={[
                                {
                                  value: "",
                                  label: "Select class",
                                  disabled: true,
                                },
                                ...Array.from({ length: 10 }, (_, i) => ({
                                  value: String(i + 3),
                                  label: `Class ${i + 3}`,
                                })),
                              ]}
                            />
                          </Field>
                          {requiresAge && (
                            <Field label="Participant age on the event date">
                              <Input
                                required
                                type="number"
                                min={5}
                                max={30}
                                value={solo.age ?? ""}
                                onChange={(e) =>
                                  setSolo({
                                    ...solo,
                                    age:
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </Field>
                          )}
                        </div>
                        {eligibilityIssues.length > 0 && (
                          <div className="form-error" role="status">
                            <ul>
                              {eligibilityIssues.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                            <p>
                              Check these details or go back to change your
                              events. Your selections have been kept.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {teamEntries.map((entry) => {
                  const s = segments.find((s) => s.id === entry.segmentId)!;
                  return (
                    <div className="form-panel" key={s.id}>
                      <h2>{s.name}</h2>
                      <p>
                        {s.category} ·{" "}
                        {s.kind === "team"
                          ? `Enter exactly ${s.minTeam} members, including the captain.`
                          : "Enter one participant."}
                      </p>
                      {s.kind === "team" && (
                        <Field label="Team name">
                          <Input
                            required
                            minLength={2}
                            maxLength={100}
                            value={entry.teamName || ""}
                            onChange={(e) =>
                              updateEntry(s.id, (v) => ({
                                ...v,
                                teamName: e.target.value,
                              }))
                            }
                          />
                        </Field>
                      )}
                      {entry.participants.map((p, i) => (
                        <div className="roster" key={i}>
                          <div className="roster-head">
                            <h3>
                              {s.kind === "team"
                                ? i === 0
                                  ? "Team captain"
                                  : "Team member " + (i + 1)
                                : "Participant"}
                            </h3>
                            {s.kind === "team" &&
                              entry.participants.length > s.minTeam! &&
                              i > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    updateEntry(s.id, (v) => ({
                                      ...v,
                                      participants: v.participants.filter(
                                        (_, j) => j !== i,
                                      ),
                                    }))
                                  }
                                >
                                  <MinusIcon size={16} />
                                  Remove
                                </Button>
                              )}
                          </div>
                          <Field label="Reuse a participant (optional)">
                            <AnimatedDropdown
                              label="Reuse a participant (optional)"
                              value=""
                              onChange={(value) => {
                                if (!value) return;
                                const person = JSON.parse(value) as Person;
                                updateEntry(s.id, (old) => ({
                                  ...old,
                                  participants: old.participants.map(
                                    (value, index) =>
                                      index === i ? { ...person } : value,
                                  ),
                                }));
                              }}
                              options={[
                                {
                                  value: "",
                                  label:
                                    "Enter details below or select a person",
                                },
                                ...Array.from(
                                  new Map(
                                    (legacyProfiles.length
                                      ? teamEntries
                                      : entries
                                    )
                                      .flatMap((other) =>
                                        other.segmentId === s.id
                                          ? []
                                          : other.participants,
                                      )
                                      .filter(
                                        (person) =>
                                          person.name &&
                                          person.school &&
                                          s.classes.includes(person.class),
                                      )
                                      .map((person) => [
                                        JSON.stringify(person),
                                        person,
                                      ]),
                                  ).entries(),
                                ).map(([value, person]) => ({
                                  value,
                                  label: `${person.name} — Class ${person.class}`,
                                })),
                              ]}
                            />
                          </Field>
                          <div className="field-grid">
                            {s.minAge && (
                              <Field label="Age on the event date">
                                <Input
                                  type="number"
                                  required
                                  min={s.minAge}
                                  max={30}
                                  value={p.age ?? ""}
                                  onChange={(event) =>
                                    personChange(
                                      s.id,
                                      i,
                                      "age",
                                      Number(event.target.value),
                                    )
                                  }
                                />
                              </Field>
                            )}
                            <Field label="Full name">
                              <Input
                                required
                                minLength={2}
                                maxLength={100}
                                value={p.name}
                                onChange={(e) =>
                                  personChange(s.id, i, "name", e.target.value)
                                }
                              />
                            </Field>
                            <Field label="School or college">
                              <Input
                                required
                                minLength={2}
                                maxLength={180}
                                value={p.school}
                                onChange={(e) =>
                                  personChange(
                                    s.id,
                                    i,
                                    "school",
                                    e.target.value,
                                  )
                                }
                              />
                            </Field>
                            <Field label="Class">
                              <AnimatedDropdown
                                label="Class"
                                required
                                value={p.class ? String(p.class) : ""}
                                onChange={(value) =>
                                  personChange(s.id, i, "class", Number(value))
                                }
                                options={[
                                  {
                                    value: "",
                                    label: "Select class",
                                    disabled: true,
                                  },
                                  ...s.classes.map((c) => ({
                                    value: String(c),
                                    label: `Class ${c}`,
                                  })),
                                ]}
                              />
                            </Field>
                          </div>
                        </div>
                      ))}
                      {s.kind === "team" &&
                        entry.participants.length < s.maxTeam! && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              updateEntry(s.id, (v) => ({
                                ...v,
                                participants: [...v.participants, blank()],
                              }))
                            }
                          >
                            <PlusIcon size={16} />
                            Add team member
                          </Button>
                        )}
                    </div>
                  );
                })}
              </>
            )}
            {step === 2 && (
              <>
                <div className="form-panel">
                  <h2>One last look.</h2>
                  <h3>{contact.name}</h3>
                  <p>
                    {contact.email}
                    <br />
                    {contact.phone}
                  </p>
                  {entries.map((e) => (
                    <div key={e.segmentId} className="roster">
                      <h3>
                        {segments.find((s) => s.id === e.segmentId)?.name}
                        {e.teamName ? " · " + e.teamName : ""}
                      </h3>
                      {e.participants.map((p, i) => (
                        <p key={i}>
                          {p.name} · Class {p.class}
                          {p.age ? ` · Age ${p.age}` : ""}
                          <br />
                          <small>{p.school}</small>
                        </p>
                      ))}
                    </div>
                  ))}
                  <label className="check-row">
                    <AnimatedCheckbox
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      {demo
                        ? "I understand this is a test using fictional information."
                        : "I have permission to submit these participants’ information and agree that organisers may use it to manage this application."}{" "}
                      <a href="/privacy" target="_blank" className="text-link">
                        Read the privacy notice
                      </a>
                    </span>
                  </label>
                </div>
                <div className="notice">
                  <LockKeyIcon size={20} />
                  <p>
                    Saving creates a private retrieval link. Keep it safe: you
                    will need it to submit payment details and check your
                    status.
                  </p>
                </div>
              </>
            )}
          </motion.div>
          <div className="form-actions">
            {step > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  navigateStep(step - 1);
                  setError("");
                }}
              >
                <ArrowLeftIcon size={18} />
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              disabled={busy || !key || available.length === 0}
            >
              {busy ? (
                <BusyIndicator
                  label={step === 1 ? "Checking total…" : "Saving application…"}
                  state={step === 1 ? "solving" : "working"}
                />
              ) : step === 2 ? (
                demo ? (
                  "Save test application"
                ) : (
                  "Save application"
                )
              ) : (
                "Continue"
              )}
              <ArrowRightIcon size={18} />
            </Button>
          </div>
        </form>
        <aside className="summary-panel" data-material="glass">
          <LiquidGlassSurface spotlight resizeDelay={80} />
          <h2>Your application</h2>
          {demo && (
            <span className="demo-label">Test registration · No money</span>
          )}
          <MeasuredSummary>
            <AnimatePresence initial={false} mode="popLayout">
              {entries.length ? (
                entries.map((e) => {
                  const s = segments.find((s) => s.id === e.segmentId);
                  if (!s)
                    return (
                      <motion.p
                        key={e.segmentId}
                        initial={reduced !== false ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduced !== false ? 0 : 0.16 }}
                      >
                        Unavailable event: {e.segmentId}
                      </motion.p>
                    );
                  return (
                    <motion.div
                      className="summary-line"
                      key={s.id}
                      initial={reduced !== false ? false : { opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={
                        reduced !== false
                          ? { opacity: 0 }
                          : { opacity: 0, x: -6 }
                      }
                      transition={{ duration: reduced !== false ? 0 : 0.18 }}
                    >
                      <span>
                        {s.name}
                        <small style={{ display: "block" }}>
                          {s.kind === "team" ? "Once per team" : "One person"}
                        </small>
                      </span>
                      <span>
                        {money(
                          step === 2 && quote
                            ? quote.entries.find(
                                (entry) => entry.segmentId === s.id,
                              )!.price!
                            : s.fee!,
                        )}
                      </span>
                    </motion.div>
                  );
                })
              ) : (
                <motion.p
                  key="empty"
                  initial={false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced !== false ? 0 : 0.14 }}
                  style={{ marginTop: 18 }}
                >
                  Your chosen segments will appear here.
                </motion.p>
              )}
            </AnimatePresence>
          </MeasuredSummary>
          <div className="summary-total">
            <span>Total</span>
            <ChangingValue value={money(total)} />
          </div>
          <small>
            {step === 2
              ? "Itemised prices checked by the server."
              : "The server will confirm your total on the review step."}
          </small>
          <p
            className="summary-note"
            style={{ fontSize: ".85rem", marginTop: 22 }}
          >
            No payment is collected by this form.{" "}
            {demo
              ? "Do not transfer real money during testing."
              : "bKash instructions follow after saving."}
          </p>
        </aside>
      </div>
    </div>
  );
}
