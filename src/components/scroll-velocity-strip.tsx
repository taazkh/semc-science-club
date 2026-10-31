"use client";

import { useEffect, useRef, useState } from "react";
import {
  useMotionValue,
  useReducedMotion,
  useSpring,
  useVelocity,
} from "motion/react";

// Componentry's velocity pattern; repeat distance is measured.
export function ScrollVelocityStrip({
  items,
  className = "",
}: {
  items: readonly string[];
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(4);
  const reduced = useReducedMotion();
  const scrollPosition = useMotionValue(0);
  const scrollVelocity = useVelocity(scrollPosition);
  const smoothedVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });
  const content = items.join(" · ");
  useEffect(() => {
    const element = host.current;
    if (!element || reduced !== false || !content) return;
    const tracks = Array.from(
      element.querySelectorAll<HTMLElement>(".velocity-track"),
    );
    const distances = [1];
    const offsets = [0];
    let frame = 0,
      lastTime = 0,
      visible = false,
      direction = 1;
    const measure = () => {
      tracks.forEach((track, index) => {
        distances[index] =
          (track.firstElementChild as HTMLElement | null)?.offsetWidth || 1;
      });
      setCopies(
        Math.max(
          4,
          Math.ceil(element.clientWidth / Math.max(1, distances[0])) + 2,
        ),
      );
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = lastTime = 0;
      smoothedVelocity.jump(0);
      tracks.forEach((track) => {
        track.style.willChange = "auto";
      });
    };
    const draw = (now: number) => {
      if (!visible || document.hidden) {
        stop();
        return;
      }
      const dt = Math.min(0.05, (now - (lastTime || now - 16.67)) / 1000);
      lastTime = now;
      const velocity = Math.max(-1500, Math.min(1500, smoothedVelocity.get()));
      if (Math.abs(velocity) > 8) direction = Math.sign(velocity);
      const speed = 36 * (1 + Math.min(4, Math.abs(velocity) / 200));
      tracks.forEach((track, index) => {
        const distance = distances[index];
        offsets[index] =
          (((offsets[index] + speed * direction * dt) % distance) + distance) %
          distance;
        track.style.transform = `translateX(${-offsets[index]}px)`;
      });
      frame = requestAnimationFrame(draw);
    };
    const sync = () => {
      if (!visible || document.hidden) {
        stop();
        return;
      }
      scrollPosition.jump(window.scrollY);
      if (!frame) {
        tracks.forEach((track) => {
          track.style.willChange = "transform";
        });
        frame = requestAnimationFrame(draw);
      }
    };
    const scroll = () => {
      if (visible && !document.hidden) scrollPosition.set(window.scrollY);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const resize = new ResizeObserver(measure);
    tracks.forEach((track) => {
      if (track.firstElementChild) resize.observe(track.firstElementChild);
    });
    resize.observe(element);
    measure();
    observer.observe(element);
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      tracks.forEach((track) => {
        track.style.transform = "none";
      });
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [reduced, content, scrollPosition, smoothedVelocity]);
  if (!items.length) return null;
  return (
    <div
      className={`velocity-strip velocity-strip-continuous ${className}`}
      ref={host}
    >
      <span className="sr-only">Programme: {items.join(", ")}.</span>
      <div className="velocity-row" aria-hidden="true">
        <div className="velocity-track">
          {Array.from({ length: copies }, (_, copy) => (
            <span key={copy}>{content} · </span>
          ))}
        </div>
      </div>
    </div>
  );
}
