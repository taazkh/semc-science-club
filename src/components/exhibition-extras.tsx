"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ScrollVelocityStrip } from "./scroll-velocity-strip";
export { FestivalCountdown } from "./festival-countdown";
export { MentorMessage } from "./mentor-statements";
import { useReveal } from "@/lib/redesign/reveal";
import type { Segment } from "@/lib/types";

export function CategoryMorph({ value }: { value: string }) {
  const reduced = useReducedMotion();
  const id = `category-morph-${useId().replace(/:/g, "")}`;
  const stage = useRef<HTMLSpanElement>(null);
  const outgoing = useRef<HTMLSpanElement>(null);
  const incoming = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  useLayoutEffect(() => {
    const host = stage.current,
      old = outgoing.current,
      next = incoming.current;
    if (!host || !old || !next) return;
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      host.style.filter = "none";
      old.style.opacity = "0";
      old.style.filter = "none";
      old.style.transform = "none";
      next.style.opacity = "1";
      next.style.filter = "none";
      next.style.transform = "none";
      old.style.willChange = next.style.willChange = "auto";
    };
    if (
      previous.current === value ||
      reduced !== false ||
      document.hidden ||
      document.documentElement.dataset.motion !== "enhanced"
    ) {
      previous.current = value;
      finish();
      return;
    }
    old.textContent = previous.current;
    previous.current = value;
    host.style.filter = `url(#${id})`;
    old.style.willChange = next.style.willChange = "filter, opacity, transform";
    const smooth = (progress: number) => {
      const p = Math.max(0, Math.min(1, progress));
      return p * p * (3 - 2 * p);
    };
    const started = performance.now();
    const render = (now: number) => {
      const progress = Math.min(1, (now - started) / 380);
      const enter = smooth(progress / 0.82),
        exit = smooth((progress - 0.18) / 0.82);
      old.style.opacity = String(Math.pow(1 - exit, 0.55));
      old.style.filter = `blur(${8 * exit}px)`;
      old.style.transform = `scale(${1 - exit * 0.012})`;
      next.style.opacity = String(Math.pow(enter, 0.55));
      next.style.filter = `blur(${8 * (1 - enter)}px)`;
      next.style.transform = `scale(${0.988 + enter * 0.012})`;
      if (progress < 1) frame = requestAnimationFrame(render);
      else finish();
    };
    render(started);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) finish();
    });
    observer.observe(host);
    const hidden = () => {
      if (document.hidden) finish();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", hidden);
      finish();
    };
  }, [value, reduced, id]);
  return (
    <span className="category-morph">
      <span className="sr-only">{value}</span>
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter
            id={id}
            x="-30%"
            y="-50%"
            width="160%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8.28"
              result="threshold"
            />
            <feComposite in="SourceGraphic" in2="threshold" operator="atop" />
          </filter>
        </defs>
      </svg>
      <span className="category-morph-stage" ref={stage} aria-hidden="true">
        <span ref={outgoing} className="category-morph-old" />
        <span ref={incoming}>{value}</span>
      </span>
    </span>
  );
}

export function VelocityStrip({ segments }: { segments: Segment[] }) {
  return (
    <ScrollVelocityStrip items={segments.map((segment) => segment.name)} />
  );
}

const prepareProgramme = (node: HTMLSpanElement) =>
  Array.from(node.querySelectorAll(".programme-intro-word")).map(
    (word, index) =>
      word.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 560,
          delay: Math.min(index * 28, 280),
          fill: "both",
          easing: "cubic-bezier(.16,1,.3,1)",
        },
      ),
  );

export function ProgrammeIntro({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useReveal(ref, prepareProgramme);
  const words = children.split(" ");
  return (
    <span ref={ref} className="programme-intro" data-reveal="pending">
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <span key={index} className="programme-intro-word">
            {word}
            {index < words.length - 1 ? "\u00a0" : ""}
          </span>
        ))}
      </span>
    </span>
  );
}

const prepareParticipation = (node: HTMLSpanElement) =>
  Array.from(node.querySelectorAll(".participation-intro-line")).map(
    (line, index) =>
      line.animate(
        [
          { opacity: 0, transform: "translateX(-32px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 560,
          delay: index * 100,
          fill: "both",
          easing: "cubic-bezier(.22,1,.36,1)",
        },
      ),
  );

export function ParticipationIntro({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  useReveal(ref, prepareParticipation);
  return (
    <span ref={ref} className="participation-intro" data-reveal="pending">
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true">
        {lines.map((line) => (
          <span key={line} className="participation-intro-line">
            {line}
          </span>
        ))}
      </span>
    </span>
  );
}
