"use client";

// React Bits ChromaGrid, Copyright (c) 2026 David Haz.
// Pinned source: ca44b3f9ee180676a06d7de8ec6bea84cddff85b.
// MIT + Commons Clause: licence retained in ./LICENSE.md.
// Adaptation keeps upstream GSAP damping and radial grayscale/fade masks,
// scoped to photographs with native profile controls and bounded lifecycles.
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { gsap } from "gsap";
import "./chroma-grid.css";

export interface ChromaItem {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  borderColor?: string;
  gradient?: string;
  portrait?: ReactNode;
  caption?: ReactNode;
}

interface ChromaGridProps {
  items: ChromaItem[];
  className?: string;
  radius?: number;
  damping?: number;
  fadeOut?: number;
  ease?: string;
}

type SetterFn = (value: number | string) => void;

export function ChromaGrid({
  items,
  className = "",
  radius = 280,
  damping = 0.24,
  fadeOut = 0.24,
  ease = "power3.out",
}: ChromaGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement[]>([]);
  const setX = useRef<SetterFn | null>(null);
  const setY = useRef<SetterFn | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const enabled = useRef(false);
  const moveFrame = useRef(0);
  const latestPointer = useRef<{
    x: number;
    y: number;
    card: HTMLElement | null;
  } | null>(null);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const supported =
      CSS.supports("backdrop-filter", "grayscale(1)") &&
      CSS.supports("mask-image", "radial-gradient(white, transparent)");
    const photographs = Array.from(
      root.querySelectorAll<HTMLElement>(".chroma-photo"),
    );
    const cards = Array.from(
      root.querySelectorAll<HTMLElement>(".chroma-card"),
    );
    fadeRef.current = Array.from(
      root.querySelectorAll<HTMLDivElement>(".chroma-fade"),
    );
    setX.current = gsap.quickSetter(root, "--x", "px") as SetterFn;
    setY.current = gsap.quickSetter(root, "--y", "px") as SetterFn;
    let visible = typeof IntersectionObserver === "undefined";
    let measureFrame = 0;
    enabled.current = false;
    setInteractive(false);

    const reset = () => {
      cancelAnimationFrame(moveFrame.current);
      moveFrame.current = 0;
      latestPointer.current = null;
      gsap.killTweensOf(pos.current);
      gsap.killTweensOf(fadeRef.current);
      gsap.set(fadeRef.current, { opacity: 1 });
    };
    const measure = () => {
      measureFrame = 0;
      if (!enabled.current) return;
      const bounds = root.getBoundingClientRect();
      const offsets = photographs.map((photo) => {
        const rect = photo.getBoundingClientRect();
        return { photo, x: rect.left - bounds.left, y: rect.top - bounds.top };
      });
      offsets.forEach(({ photo, x, y }) => {
        photo.style.setProperty("--portrait-x", `${x}px`);
        photo.style.setProperty("--portrait-y", `${y}px`);
      });
    };
    const scheduleMeasure = () => {
      if (!enabled.current || measureFrame) return;
      measureFrame = requestAnimationFrame(measure);
    };
    const update = () => {
      const next =
        supported &&
        finePointer.matches &&
        !reducedMotion.matches &&
        visible &&
        !document.hidden;
      if (next === enabled.current) return;
      enabled.current = next;
      setInteractive(next);
      reset();
      if (next) {
        const bounds = root.getBoundingClientRect();
        pos.current.x = bounds.width / 2;
        pos.current.y = bounds.height / 2;
        setX.current?.(pos.current.x);
        setY.current?.(pos.current.y);
        scheduleMeasure();
      } else {
        cancelAnimationFrame(measureFrame);
        measureFrame = 0;
      }
    };
    const intersection =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            update();
          });
    const resize = new ResizeObserver(scheduleMeasure);
    resize.observe(root);
    cards.forEach((card) => resize.observe(card));
    intersection?.observe(root);
    finePointer.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("blur", reset);
    update();
    return () => {
      enabled.current = false;
      reset();
      cancelAnimationFrame(measureFrame);
      intersection?.disconnect();
      resize.disconnect();
      finePointer.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("blur", reset);
      setX.current = null;
      setY.current = null;
      fadeRef.current = [];
    };
  }, [items]);

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled.current || event.pointerType !== "mouse") return;
    latestPointer.current = {
      x: event.clientX,
      y: event.clientY,
      card:
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(".chroma-card")
          : null,
    };
    if (moveFrame.current) return;
    moveFrame.current = requestAnimationFrame(() => {
      moveFrame.current = 0;
      const pointer = latestPointer.current;
      const root = rootRef.current;
      if (!enabled.current || !pointer || !root) return;
      const bounds = root.getBoundingClientRect();
      const cardBounds = pointer.card?.getBoundingClientRect();
      gsap.to(pos.current, {
        x: pointer.x - bounds.left,
        y: pointer.y - bounds.top,
        duration: damping,
        ease,
        onUpdate: () => {
          setX.current?.(pos.current.x);
          setY.current?.(pos.current.y);
        },
        overwrite: true,
      });
      gsap.to(fadeRef.current, { opacity: 0, duration: 0.18, overwrite: true });
      if (cardBounds && pointer.card) {
        pointer.card.style.setProperty(
          "--mouse-x",
          `${pointer.x - cardBounds.left}px`,
        );
        pointer.card.style.setProperty(
          "--mouse-y",
          `${pointer.y - cardBounds.top}px`,
        );
      }
    });
  };

  const handleLeave = () => {
    cancelAnimationFrame(moveFrame.current);
    moveFrame.current = 0;
    latestPointer.current = null;
    gsap.killTweensOf(pos.current);
    if (enabled.current)
      gsap.to(fadeRef.current, {
        opacity: 1,
        duration: fadeOut,
        overwrite: true,
      });
  };

  return (
    <div
      ref={rootRef}
      className={`chroma-grid ${className}`}
      data-interactive={interactive}
      style={{ "--r": `${radius}px` } as CSSProperties}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {items.map((item) => (
        <article
          key={item.id}
          className="chroma-card"
          style={
            {
              "--card-border": item.borderColor || "var(--line)",
              "--card-gradient": item.gradient || "var(--surface)",
            } as CSSProperties
          }
        >
          <div className="chroma-img-wrapper">
            <div className="chroma-photo">
              {item.portrait ?? (
                <img
                  src={item.image}
                  alt=""
                  width="480"
                  height="480"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div className="chroma-overlay" aria-hidden="true" />
              <div className="chroma-fade" aria-hidden="true" />
            </div>
          </div>
          <footer className="chroma-info">
            {item.caption ?? (
              <>
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
              </>
            )}
          </footer>
        </article>
      ))}
    </div>
  );
}
