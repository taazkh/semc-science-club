"use client";

import {
  CSSProperties,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import "./stroke-text.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export type StrokeTextTrigger = "mount" | "hover" | "scroll" | "loop";
export type StrokeTextFillMode = "wipe" | "fade" | "none";

export interface StrokeTextProps {
  text?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  drawDuration?: number;
  fillDelay?: number;
  stagger?: number;
  ease?: string;
  trigger?: StrokeTextTrigger;
  fillMode?: StrokeTextFillMode;
  fontSize?: number;
  fontWeight?: number | string;
  letterSpacing?: number;
  reverse?: boolean;
  className?: string;
  style?: CSSProperties;
  inheritTypography?: boolean;
}

interface StrokeTextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_TEXT = "Draw Attention";

const StrokeText = ({
  text = DEFAULT_TEXT,
  strokeColor = "#A78BFA",
  fillColor = "#F8FAFC",
  strokeWidth = 1.4,
  drawDuration = 0.38,
  fillDelay = 0.02,
  stagger = 0.01,
  ease = "power2.out",
  trigger = "mount",
  fillMode = "wipe",
  fontSize = 100,
  fontWeight = 400,
  letterSpacing = -3.5,
  reverse = false,
  className = "",
  style = {},
  inheritTypography = true,
}: StrokeTextProps) => {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const strokeTextRef = useRef<SVGTextElement | null>(null);
  const wipeRectRef = useRef<SVGRectElement | null>(null);
  const fallbackRef = useRef<HTMLSpanElement | null>(null);
  const baselineRef = useRef<HTMLSpanElement | null>(null);
  const played = useRef(false);
  const [typography, setTypography] = useState({
    fontSize,
    fontWeight,
    letterSpacing,
  });

  const [box, setBox] = useState<StrokeTextBox | null>(null);

  const rawId = useId();
  const wipeId = `stroke-text-wipe-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const characters = useMemo(() => Array.from(String(text ?? "")), [text]);

  const dash = Math.max(typography.fontSize * 7, 200);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const styles = getComputedStyle(root);
      const next = inheritTypography
        ? {
            fontSize: parseFloat(styles.fontSize) || fontSize,
            fontWeight: styles.fontWeight,
            letterSpacing: parseFloat(styles.letterSpacing) || 0,
          }
        : { fontSize, fontWeight, letterSpacing };
      setTypography((previous) =>
        previous.fontSize === next.fontSize &&
        previous.fontWeight === next.fontWeight &&
        previous.letterSpacing === next.letterSpacing
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [inheritTypography, fontSize, fontWeight, letterSpacing]);

  const fontStyle = useMemo<CSSProperties>(
    () => ({
      fontSize: `${typography.fontSize}px`,
      fontWeight: typography.fontWeight,
      letterSpacing: `${typography.letterSpacing}px`,
    }),
    [typography],
  );

  useLayoutEffect(() => {
    const node = strokeTextRef.current;
    if (!node) return undefined;

    let cancelled = false;

    const measure = () => {
      if (cancelled || !strokeTextRef.current) return;
      let bbox: DOMRect | undefined;
      try {
        bbox = strokeTextRef.current.getBBox();
      } catch {
        return;
      }
      if (!bbox || !bbox.width) return;

      const fallback = fallbackRef.current;
      const baseline = baselineRef.current;
      if (!fallback || !baseline) return;
      const bounds = fallback.getBoundingClientRect();
      const next = {
        x: 0,
        y: bounds.top - baseline.getBoundingClientRect().top,
        width: bounds.width,
        height: bounds.height,
      };

      setBox((prev) =>
        prev &&
        Math.abs(prev.x - next.x) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.y - next.y) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (fallbackRef.current) observer.observe(fallbackRef.current);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [characters, typography, strokeWidth]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (typeof window === "undefined" || !root || !box) return undefined;

    const strokes = gsap.utils.toArray(
      root.querySelectorAll("[data-stroke-char]"),
    );
    const fills = gsap.utils.toArray(root.querySelectorAll("[data-fill-char]"));
    const wipe = wipeRectRef.current;
    if (!strokes.length) return undefined;

    const fillEnabled = fillMode !== "none";
    const useWipe = fillEnabled && fillMode === "wipe";
    const drawSeconds = Math.min(0.4, Math.max(0.1, drawDuration));
    const fillSeconds = Math.min(0.02, Math.max(0, fillDelay));
    const boundedStagger = Math.min(
      Math.max(0, stagger),
      0.05 / Math.max(1, characters.length - 1),
    );
    const fillDuration = 0.4;
    const staggerConfig: number | gsap.StaggerVars = reverse
      ? { each: boundedStagger, from: "end" as const }
      : boundedStagger;
    const targets = [...strokes, ...fills, wipe].filter(Boolean);

    const setStart = () => {
      root.dataset.complete = "false";
      gsap.killTweensOf(targets);
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: dash });
      gsap.set(fills, { opacity: useWipe ? 1 : 0 });
      if (wipe) gsap.set(wipe, { attr: { width: 0 } });
    };

    const setEnd = () => {
      gsap.killTweensOf(targets);
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: 0 });
      gsap.set(fills, { opacity: fillEnabled ? 1 : 0 });
      if (wipe)
        gsap.set(wipe, { attr: { width: fillEnabled ? box.width : 0 } });
      root.dataset.complete = "true";
    };

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (
      media.matches ||
      document.hidden ||
      (trigger === "mount" && played.current)
    ) {
      setEnd();
      return () => gsap.killTweensOf(targets);
    }

    const build = () => {
      setStart();
      const tl = gsap.timeline({
        paused: true,
        repeat: trigger === "loop" ? -1 : 0,
        repeatDelay: trigger === "loop" ? 0.9 : 0,
        defaults: { overwrite: "auto" },
        onComplete: () => {
          played.current = true;
          setEnd();
        },
      });

      tl.to(
        strokes,
        {
          strokeDashoffset: 0,
          duration: drawSeconds,
          ease,
          stagger: staggerConfig,
        },
        0,
      );

      if (useWipe && wipe) {
        tl.to(
          wipe,
          {
            attr: { width: box.width },
            duration: fillDuration,
            ease: "power2.inOut",
          },
          drawSeconds + fillSeconds,
        );
      } else if (fillEnabled) {
        tl.to(
          fills,
          {
            opacity: 1,
            duration: fillDuration,
            ease: "power2.out",
            stagger: staggerConfig,
          },
          drawSeconds + fillSeconds,
        );
      }

      return tl;
    };

    let timeline: gsap.core.Timeline | null = null;
    let playRequested = false;
    const play = () => {
      playRequested = true;
      if (!document.documentElement.dataset.initialLoading) timeline?.play(0);
    };
    const onLoaded = () => {
      if (playRequested && !played.current) timeline?.play(0);
    };
    window.addEventListener("semc-initial-loading-complete", onLoaded);
    let scrollTrigger: ReturnType<typeof ScrollTrigger.create> | null = null;
    let removeHover: (() => void) | null = null;
    const finish = () => {
      timeline?.kill();
      played.current = true;
      setEnd();
    };
    const onHidden = () => {
      if (document.hidden) finish();
    };
    const onReduced = () => {
      if (media.matches) finish();
    };
    document.addEventListener("visibilitychange", onHidden);
    media.addEventListener("change", onReduced);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && timeline?.isActive()) finish();
    });
    observer.observe(root);

    if (trigger === "hover") {
      setEnd();
      const hover = () => {
        timeline?.kill();
        timeline = build();
        play();
      };
      root.addEventListener("pointerenter", hover);
      removeHover = () => root.removeEventListener("pointerenter", hover);
    } else {
      timeline = build();
      if (trigger === "scroll") {
        scrollTrigger = ScrollTrigger.create({
          trigger: root,
          start: "top 82%",
          once: true,
          onEnter: play,
        });
      } else {
        play();
      }
    }

    return () => {
      removeHover?.();
      scrollTrigger?.kill();
      timeline?.kill();
      gsap.killTweensOf(targets);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("semc-initial-loading-complete", onLoaded);
      media.removeEventListener("change", onReduced);
      observer.disconnect();
    };
  }, [
    box,
    dash,
    drawDuration,
    fillDelay,
    stagger,
    ease,
    trigger,
    fillMode,
    reverse,
    characters.length,
  ]);

  const viewBox = box
    ? `${box.x} ${box.y} ${box.width} ${box.height}`
    : `0 ${-fontSize} 600 ${fontSize * 1.3}`;

  return (
    <span
      ref={rootRef}
      className={`stroke-text ${trigger === "hover" ? "stroke-text--hover" : ""} ${className}`.trim()}
      style={style}
      data-ready={box ? "true" : "false"}
      role="img"
      aria-label={String(text ?? "")}
    >
      <span
        ref={fallbackRef}
        className="stroke-text__fallback"
        aria-hidden="true"
      >
        {text}
        <span ref={baselineRef} className="stroke-text__baseline" />
      </span>
      <svg
        className="stroke-text__svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {fillMode === "wipe" && box && (
          <defs>
            <clipPath id={wipeId} clipPathUnits="userSpaceOnUse">
              <rect
                ref={wipeRectRef}
                x={box.x}
                y={box.y}
                width="0"
                height={box.height}
              />
            </clipPath>
          </defs>
        )}

        <text
          ref={strokeTextRef}
          className="stroke-text__stroke"
          x="0"
          y="0"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={fontStyle}
        >
          {characters.map((char, index) => (
            <tspan data-stroke-char key={`s-${index}`}>
              {char}
            </tspan>
          ))}
        </text>

        <text
          className="stroke-text__fill"
          x="0"
          y="0"
          fill={fillColor}
          stroke="none"
          style={fontStyle}
          clipPath={fillMode === "wipe" && box ? `url(#${wipeId})` : undefined}
        >
          {characters.map((char, index) => (
            <tspan data-fill-char key={`f-${index}`}>
              {char}
            </tspan>
          ))}
        </text>
      </svg>
    </span>
  );
};

export default StrokeText;
