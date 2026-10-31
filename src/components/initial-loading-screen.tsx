"use client";

import { useEffect } from "react";
import { firstViewReady } from "@/lib/redesign/initial-loading";
import StatusMark from "./react-bits/status-mark";
import "./initial-loading-screen.css";

export function InitialLoadingScreen() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.dataset.initialLoading) return;
    let alive = true;
    let frame = 0;
    let fade = 0;
    let observer: MutationObserver | undefined;
    const stop = () => {
      alive = false;
      observer?.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(fade);
      window.removeEventListener("semc-initial-loading-complete", stop);
    };
    const finish = () => {
      if (!alive || !root.dataset.initialLoading) return;
      root.dataset.initialLoading = "leaving";
      fade = window.setTimeout(() => {
        delete root.dataset.initialLoading;
        window.dispatchEvent(new Event("semc-initial-loading-complete"));
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
    };
    window.addEventListener("semc-initial-loading-complete", stop);
    const ready = new Promise<void>((resolve) => {
      const check = () => {
        if (firstViewReady()) {
          observer?.disconnect();
          resolve();
        }
      };
      observer = new MutationObserver(check);
      observer.observe(document.body, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ["data-scene-state", "data-reveal-owned", "data-ready"],
      });
      check();
    });
    const images = Array.from(document.images).filter((image) => {
      const bounds = image.getBoundingClientRect();
      return bounds.top < innerHeight && bounds.bottom > 0;
    }).map((image) => image.decode().catch(() => {}));
    Promise.all([ready, document.fonts.ready, ...images]).then(() => {
      if (!alive) return;
      // Let font measurements and the first prepared render settle before
      // releasing entrances; no fixed minimum loading duration.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(finish);
      });
    }).catch(finish);
    return () => {
      stop();
      window.removeEventListener("semc-initial-loading-complete", stop);
    };
  }, []);

  return (
    <div className="initial-loading-screen" role="status" aria-live="polite">
      <div className="initial-loading-copy">
        <strong>SEMC</strong>
        <span>Science Club</span>
        <StatusMark status="running" size={24} label="Preparing the exhibition" />
      </div>
    </div>
  );
}
