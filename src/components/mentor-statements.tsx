"use client";

import { useId } from "react";
import { ArrowUpRightIcon } from "./icons";
import { HoverTransition } from "./ui/hover-transition";
import "./mentor-statements.css";

const teachers = [
  {
    name: "Md. Yasin Arafat",
    role: "Head / Moderator",
    effect: "morph",
    direction: "left",
    quote:
      "A pendulum gives you a pattern. Science begins when you measure it, challenge your assumptions, and ask where the pattern stops holding true.",
  },
  {
    name: "Mohammad Amjad Hossain",
    role: "Co-moderator",
    effect: "slide",
    direction: "left",
    quote:
      "A noisy measurement is not a failed experiment. Learn what your instrument can resolve, repeat the observation, and make uncertainty part of your answer.",
  },
] as const;

function QuoteFace({ teacher }: { teacher: (typeof teachers)[number] }) {
  return (
    <div className="teacher-quote-reveal">
      <blockquote>
        <p>{teacher.quote}</p>
      </blockquote>
      <div className="teacher-quote-attribution">
        <h3>{teacher.name}</h3>
        <p>{teacher.role}</p>
        <small>Draft quote · Awaiting teacher approval</small>
      </div>
    </div>
  );
}

export function MentorMessage() {
  const id = useId();
  return (
    <section
      className="mentor-statements shell section"
      aria-labelledby={`${id}-heading`}
    >
      <header className="mentor-statements-heading">
        <h2 id={`${id}-heading`}>A message for curious minds.</h2>
        <p>
          Hover or focus on a name to read. On touch screens, tap to reveal
          the message.
        </p>
      </header>
      <div className="mentor-statements-grid">
        {teachers.map((teacher, index) => {
          const quoteId = `${id}-quote-${index}`;
          return (
            <article className="mentor-statement-panel" key={teacher.name}>
              <HoverTransition
                className="teacher-quote-transition"
                label={`Read the draft quote for ${teacher.name}`}
                aria-describedby={quoteId}
                effect={teacher.effect}
                direction={teacher.direction}
                duration={0.72}
                sizingComponent={<QuoteFace teacher={teacher} />}
                defaultComponent={
                  <div className="teacher-quote-portrait">
                    <div className="teacher-quote-portrait-caption">
                      <h3>{teacher.name}</h3>
                      <p>{teacher.role}</p>
                      <span className="teacher-quote-prompt">
                        Read the message{" "}
                        <ArrowUpRightIcon size={20} aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                }
                hoverComponent={<QuoteFace teacher={teacher} />}
              />
              <div id={quoteId} className="sr-only">
                <h3>
                  {teacher.name}, {teacher.role}
                </h3>
                <blockquote>
                  <p>{teacher.quote}</p>
                </blockquote>
                <p>
                  Draft quote awaiting teacher approval. Activate to hold the
                  message. Activate again or press Escape to return to the
                  name.
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mentor-statements-note">
        Original science reflections drafted for this preview. Final wording
        awaits teacher approval.
      </p>
      <a className="text-link mentor-statements-link" href="/members">
        Meet our student council{" "}
        <ArrowUpRightIcon size={20} aria-hidden="true" />
      </a>
    </section>
  );
}
