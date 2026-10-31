"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useReveal } from "@/lib/redesign/reveal";

const maskLines = (node: HTMLSpanElement) =>
  Array.from(node.querySelectorAll(".mask-reveal-line-text")).map(
    (line, index) =>
      line.animate(
        [
          { opacity: 0, transform: "translateY(30px)", filter: "blur(6px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        {
          duration: 760,
          delay: Math.min(index * 90, 140),
          easing: "cubic-bezier(.16,1,.3,1)",
          fill: "both",
        },
      ),
  );

// SmoothUI Mask Reveal Up pattern; one pre-paint/reveal owner per text island.
export function MaskRevealText({
  lines,
  className = "",
}: {
  lines: readonly string[];
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useReveal(ref, maskLines);
  return (
    <span
      className={`smooth-text mask-reveal-text ${className}`}
      ref={ref}
      data-reveal="pending"
    >
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true">
        {lines.map((line, index) => (
          <span className="mask-reveal-line" key={index}>
            <span className="mask-reveal-line-text">{line}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

const resolveFocus = (node: HTMLSpanElement) => {
  const text = node.querySelector(".focus-resolve-text");
  return text
    ? [
        text.animate(
          [
            {
              opacity: 0,
              transform: "translateY(14px) scale(1.01)",
              filter: "blur(14px)",
            },
            { opacity: 1, transform: "none", filter: "blur(0px)" },
          ],
          { duration: 760, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" },
        ),
      ]
    : [];
};

// Use for one short statement; keep this separate from the masked heading.
export function FocusResolveText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useReveal(ref, resolveFocus);
  return (
    <span
      className={`smooth-text ${className}`}
      ref={ref}
      data-reveal="pending"
    >
      <span className="sr-only">{text}</span>
      <span className="focus-resolve-text" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}

export type TextEntranceVariant =
  | "depth-parallax-words"
  | "fade-through"
  | "micro-scale-fade"
  | "per-character-rise"
  | "scale-down-fade"
  | "reveal-text";

function graphemes(text: string) {
  return typeof Intl.Segmenter === "undefined"
    ? Array.from(text)
    : Array.from(
        new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text),
        (part) => part.segment,
      );
}

const entranceSpec = {
  "depth-parallax-words": {
    from: {
      opacity: 0,
      transform: "translateY(18px) scale(.92)",
      filter: "blur(3px)",
    },
    duration: 700,
    stagger: 70,
    easing: "cubic-bezier(.22,1,.36,1)",
  },
  "micro-scale-fade": {
    from: { opacity: 0, transform: "scale(.96)" },
    duration: 600,
    stagger: 0,
    easing: "cubic-bezier(.32,.72,0,1)",
  },
  "per-character-rise": {
    from: { opacity: 0, transform: "translateY(32px)" },
    duration: 700,
    stagger: 24,
    easing: "cubic-bezier(.2,.8,.2,1)",
  },
  "scale-down-fade": {
    from: { opacity: 0, transform: "translateY(8px) scale(1.04)" },
    duration: 520,
    stagger: 0,
    easing: "cubic-bezier(.22,1,.36,1)",
  },
  "reveal-text": {
    from: { opacity: 0, transform: "translateY(24px)" },
    duration: 250,
    stagger: 0,
    easing: "ease-out",
  },
};

function CoordinatedText({
  text,
  variant,
  className = "",
}: {
  text: string;
  variant: Exclude<TextEntranceVariant, "fade-through">;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prepare = useMemo(
    () => (node: HTMLSpanElement) => {
      const spec = entranceSpec[variant];
      return Array.from(node.querySelectorAll(".text-entrance-piece")).map(
        (piece, index) =>
          piece.animate(
            [spec.from, { opacity: 1, transform: "none", filter: "blur(0px)" }],
            {
              duration: spec.duration,
              delay: Math.min(index * spec.stagger, 900 - spec.duration),
              easing: spec.easing,
              fill: "both",
            },
          ),
      );
    },
    [variant],
  );
  useReveal(ref, prepare);
  const pieces =
    variant === "depth-parallax-words"
      ? text.split(/(\s+)/)
      : variant === "per-character-rise"
        ? graphemes(text)
        : [text];
  return (
    <span
      ref={ref}
      className={`smooth-text text-entrance ${className}`}
      data-reveal="pending"
      data-text-variant={variant}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {pieces.map((piece, index) =>
          /^\s+$/.test(piece) ? (
            <span className="text-entrance-space" key={index}>
              {piece}
            </span>
          ) : (
            <span className="text-entrance-piece" key={index}>
              {piece}
            </span>
          ),
        )}
      </span>
    </span>
  );
}

const fadeThroughEntrance = (node: HTMLSpanElement) => {
  const piece = node.querySelector(".fade-through-piece");
  return piece
    ? [
        piece.animate(
          [
            {
              opacity: 0,
              transform: "translateY(6px) scale(.99)",
              filter: "blur(2px)",
            },
            { opacity: 1, transform: "none", filter: "blur(0px)" },
          ],
          { duration: 420, easing: "cubic-bezier(.2,0,0,1)", fill: "both" },
        ),
      ]
    : [];
};

function FadeThroughText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(false);
  useReveal(ref, fadeThroughEntrance);
  useEffect(() => {
    if (!ref.current || reduced !== false) {
      setActive(false);
      return;
    }
    let visible = false;
    const sync = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(ref.current);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [reduced]);
  return (
    <span
      ref={ref}
      className={`smooth-text text-entrance ${className}`}
      data-reveal="pending"
      data-text-variant="fade-through"
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            className="fade-through-piece"
            key={text}
            initial={
              active
                ? { opacity: 0, y: 6, scale: 0.99, filter: "blur(2px)" }
                : false
            }
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{
              opacity: 0,
              y: -4,
              transition: { duration: active ? 0.26 : 0, ease: [0.4, 0, 1, 1] },
            }}
            transition={{ duration: active ? 0.42 : 0, ease: [0.2, 0, 0, 1] }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

export function TextEntrance({
  text,
  variant,
  className,
}: {
  text: string;
  variant: TextEntranceVariant;
  className?: string;
}) {
  return variant === "fade-through" ? (
    <FadeThroughText text={text} className={className} />
  ) : (
    <CoordinatedText text={text} variant={variant} className={className} />
  );
}

function HorizontalWord({
  word,
  index,
  count,
  progress,
}: {
  word: string;
  index: number;
  count: number;
  progress: MotionValue<number>;
}) {
  const start = (index / count) * 0.55;
  const opacity = useTransform(progress, [start, start + 0.45], [0, 1]);
  const x = useTransform(progress, [start, start + 0.45], [40, 0]);
  const skewX = useTransform(progress, [start, start + 0.45], [-12, 0]);
  return (
    <motion.span
      className="horizontal-text-piece"
      style={{ opacity, x, skewX }}
    >
      {word}
    </motion.span>
  );
}

// Original normal-flow interpretation of Skiper72's public description only.
// No Pro source, sticky layout, fake scroll height or scroll interception.
export function HorizontalTextReveal({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const progress = useMotionValue(1);
  const words = text.split(/(\s+)/);
  const count = words.filter((word) => !/^\s+$/.test(word)).length;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.dataset.revealOwned = "true";
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    if (
      media.matches ||
      document.documentElement.dataset.motion !== "enhanced" ||
      node.dataset.reveal === "bypass"
    ) {
      node.dataset.reveal = "complete";
      progress.jump(1);
      return;
    }
    let frame = 0,
      revealFrame = 0,
      visible = false,
      finished = false;
    const finish = () => {
      finished = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(revealFrame);
      frame = 0;
      progress.jump(1);
      node.dataset.reveal = "complete";
    };
    const update = () => {
      frame = 0;
      if (finished || document.hidden) return;
      const top = node.getBoundingClientRect().top;
      const value = Math.max(
        0,
        Math.min(1, (innerHeight * 0.9 - top) / (innerHeight * 0.65)),
      );
      progress.set(value);
      if (node.dataset.reveal === "pending" && !revealFrame)
        revealFrame = requestAnimationFrame(() => {
          revealFrame = 0;
          if (visible && !finished && !document.hidden)
            node.dataset.reveal = "running";
        });
      if (value >= 1) finish();
    };
    const schedule = () => {
      if (visible && !document.hidden && !finished && !frame)
        frame = requestAnimationFrame(update);
    };
    const hidden = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(revealFrame);
        revealFrame = 0;
        frame = 0;
      } else schedule();
    };
    const reduce = () => {
      if (media.matches) finish();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(revealFrame);
        revealFrame = 0;
        frame = 0;
      } else schedule();
    });
    observer.observe(node);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("semc-motion-bypass", finish);
    window.addEventListener("beforeprint", finish);
    document.addEventListener("visibilitychange", hidden);
    media.addEventListener("change", reduce);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(revealFrame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("semc-motion-bypass", finish);
      window.removeEventListener("beforeprint", finish);
      document.removeEventListener("visibilitychange", hidden);
      media.removeEventListener("change", reduce);
    };
  }, [progress]);
  let index = 0;
  return (
    <span
      ref={ref}
      className={`smooth-text horizontal-text-reveal ${className}`}
      data-reveal="pending"
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, key) =>
          /^\s+$/.test(word) ? (
            <span className="text-entrance-space" key={key}>
              {word}
            </span>
          ) : (
            <HorizontalWord
              word={word}
              key={key}
              index={index++}
              count={Math.max(1, count)}
              progress={progress}
            />
          ),
        )}
      </span>
    </span>
  );
}
