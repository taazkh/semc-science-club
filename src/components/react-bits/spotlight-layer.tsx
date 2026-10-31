"use client";

import { useEffect, useRef } from "react";
import "./spotlight-layer.css";

// React Bits SpotlightCard radial highlight; the host retains its glass material.
export function SpotlightLayer() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const layer = ref.current;
    const host = layer?.parentElement?.parentElement;
    if (!layer || !host) return;
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let bounds: DOMRect | null = null;
    let point = { x: 0, y: 0 };
    const deactivate = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      layer.dataset.active = "false";
    };
    const invalidate = () => {
      bounds = null;
    };
    const move = (event: PointerEvent) => {
      if (!fine.matches || reduced.matches || document.hidden) return;
      bounds ??= host.getBoundingClientRect();
      point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        layer.style.setProperty("--mouse-x", `${point.x}px`);
        layer.style.setProperty("--mouse-y", `${point.y}px`);
        layer.dataset.active = "true";
      });
    };
    const focus = () => {
      layer.style.setProperty("--mouse-x", "50%");
      layer.style.setProperty("--mouse-y", "50%");
      layer.dataset.active = "true";
    };
    const blur = (event: FocusEvent) => {
      if (!host.contains(event.relatedTarget as Node | null)) deactivate();
    };
    const observer = new ResizeObserver(invalidate);
    observer.observe(host);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", deactivate);
    host.addEventListener("focusin", focus);
    host.addEventListener("focusout", blur);
    window.addEventListener("scroll", invalidate, {
      passive: true,
      capture: true,
    });
    document.addEventListener("visibilitychange", deactivate);
    fine.addEventListener("change", deactivate);
    reduced.addEventListener("change", deactivate);
    return () => {
      deactivate();
      observer.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", deactivate);
      host.removeEventListener("focusin", focus);
      host.removeEventListener("focusout", blur);
      window.removeEventListener("scroll", invalidate, true);
      document.removeEventListener("visibilitychange", deactivate);
      fine.removeEventListener("change", deactivate);
      reduced.removeEventListener("change", deactivate);
    };
  }, []);
  return (
    <span className="glass-spotlight-layer" ref={ref} aria-hidden="true" />
  );
}
