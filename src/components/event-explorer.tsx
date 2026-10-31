"use client";
import { useState, useId, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Segment } from "@/lib/types";
import { ArrowRightIcon } from "./icons";
import { ScienceFigure } from "./science-figure";
import { money } from "@/lib/catalog";
import { CategoryMorph } from "./exhibition-extras";
import { LiquidGlassSurface } from "./liquid-glass-surface";
import { ChangingValue } from "./editorial-motion";
import JellyRadio from "./react-bits/jelly-radio";

export function EventExplorer({
  segments,
  full = false,
}: {
  segments: Segment[];
  full?: boolean;
}) {
  const instance = useId();
  const [horizontal, setHorizontal] = useState(false);
  useEffect(() => {
    const media = matchMedia("(max-width: 767px)");
    const update = () => setHorizontal(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const preferred = [
    "project-display",
    "robot-race",
    "math-olympiad",
    "bridge-building",
  ];
  const choices = [
    ...preferred
      .map((id) => segments.find((s) => s.id === id))
      .filter((s): s is Segment => !!s),
    ...segments.filter((s) => !preferred.includes(s.id)),
  ].slice(0, full ? segments.length : 4);
  const [selected, setSelected] = useState(choices[0]?.id);
  const [direction, setDirection] = useState(1);
  const reduced = useReducedMotion();
  const event = choices.find((s) => s.id === selected) || choices[0];
  if (!event)
    return <p className="notice">The programme will be announced here.</p>;
  const choose = (id: string) => {
    setDirection(
      choices.findIndex((choice) => choice.id === id) <
        choices.findIndex((choice) => choice.id === event.id)
        ? -1
        : 1,
    );
    setSelected(id);
  };
  return (
    <div className={`event-explorer ${full ? "explorer-complete" : ""}`}>
      <div>
        <JellyRadio
          className="event-jelly-choices"
          mode="tabs"
          orientation={horizontal ? "horizontal" : "vertical"}
          idPrefix={instance}
          controls={`${instance}-preview`}
          ariaLabel={
            full ? "Explore programme events" : "Explore featured events"
          }
          value={event.id}
          onChange={choose}
          chipColor="var(--surface)"
          activeColor="var(--accent)"
          textColor="var(--text)"
          activeTextColor="var(--ink)"
          items={choices.map((s) => ({
            value: s.id,
            label: (
              <>
                <span className="jelly-event-copy">
                  <strong>{s.name}</strong>
                  <small>{s.category}</small>
                </span>
                <ArrowRightIcon size={20} aria-hidden="true" />
              </>
            ),
          }))}
        />
        {!full && (
          <Link href="/stemfest#programme" className="text-link explorer-all">
            Explore all {segments.length} events <ArrowRightIcon size={20} />
          </Link>
        )}
      </div>
      <div
        id={`${instance}-preview`}
        className="event-preview"
        role="tabpanel"
        aria-labelledby={`${instance}-${event.id}`}
        tabIndex={0}
      >
        <LiquidGlassSurface />
        <div className="event-panel-content">
          <div className="preview-top">
            <CategoryMorph value={event.category} />
            <span>
              {event.rulesStatus === "approved"
                ? "Rules confirmed"
                : "Draft rules"}
            </span>
          </div>
          <ScienceFigure key={event.id} kind={event.id} interactive />
          <div className="preview-bottom">
            <div className="event-copy-axis">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={event.id}
                  custom={direction}
                  initial={reduced !== false ? false : "enter"}
                  animate="present"
                  exit="exit"
                  variants={{
                    enter: (side: number) => ({ opacity: 0, x: side * 24 }),
                    present: {
                      opacity: 1,
                      x: 0,
                      transition: {
                        duration: reduced !== false ? 0 : 0.24,
                        ease: [0.2, 0, 0, 1],
                      },
                    },
                    exit: (side: number) => ({
                      opacity: 0,
                      x: reduced !== false ? 0 : side * -20,
                      transition: {
                        duration: reduced !== false ? 0 : 0.12,
                        ease: [0.4, 0, 1, 1],
                      },
                    }),
                  }}
                >
                  <h3>{event.name}</h3>
                  <p>{event.description}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <Link
              href={`/stemfest/${event.id}`}
              className="round-link"
              aria-label={`View ${event.name} details`}
            >
              <ArrowRightIcon size={24} />
            </Link>
          </div>
          <dl className="preview-facts">
            <div>
              <dt>Who can enter</dt>
              <dd>
                {event.classes.length
                  ? `Classes ${Math.min(...event.classes)}–${Math.max(...event.classes)}`
                  : "To be confirmed"}
              </dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>
                {event.kind === "team"
                  ? `Team of ${event.minTeam}`
                  : event.kind === "exhibition"
                    ? "Exhibition"
                    : "Individual"}
              </dd>
            </div>
            <div>
              <dt>Programme fee</dt>
              <dd>
                {event.fee === null ? (
                  "Pending"
                ) : event.fee === 0 ? (
                  "Free"
                ) : (
                  <ChangingValue value={money(event.fee)} />
                )}
                {event.fee ? (
                  <small> / {event.kind === "team" ? "team" : "person"}</small>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
