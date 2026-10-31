"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { PauseIcon, PlayIcon, ArrowClockwiseIcon } from "./icons";
import type { SkyController } from "@/lib/orbital-sky";

function OrbitalScene() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<SkyController | null>(null);
  const [controlsHost, setControlsHost] = useState<Element | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (failed) return;
    setControlsHost(document.querySelector("[data-orbit-controls]"));
    let cancelled = false;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setReduced(preference.matches);
      controller.current?.reduce(preference.matches);
    };
    updatePreference();
    preference.addEventListener("change", updatePreference);
    // The scene never blocks page content or delays navigation.
    import("@/lib/orbital-sky")
      .then(({ createOrbitalSky }) => {
        if (cancelled || !canvas.current) return;
        try {
          controller.current = createOrbitalSky(canvas.current, () =>
            setFailed(true),
          );
          if (!controller.current) {
            setFailed(true);
            return;
          }
          updatePreference();
          let saved = false;
          try {
            saved = localStorage.getItem("semc-sky-paused") === "true";
          } catch {
            /* Browsers may block optional preference storage. */
          }
          controller.current.pause(saved);
          setPaused(saved);
          setReady(true);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      preference.removeEventListener("change", updatePreference);
      controller.current?.dispose();
      controller.current = null;
    };
  }, [failed]);
  if (failed) return null;
  return (
    <>
      <div className="orbital-scene" aria-hidden="true">
        <canvas ref={canvas} className="orbital-canvas" />
        <div className="orbital-vignette" />
      </div>
      {ready &&
        controlsHost &&
        createPortal(
          <div
            className="orbit-controls"
            aria-label="Illustrative orbital background controls"
          >
            <span className="orbit-caption">
              {reduced ? "Still sky · reduced motion" : "An orbital study"}
            </span>
            {!reduced && (
              <>
                <button
                  type="button"
                  aria-label={
                    paused
                      ? "Resume orbital background"
                      : "Pause orbital background"
                  }
                  onClick={() => {
                    const next = !paused;
                    setPaused(next);
                    controller.current?.pause(next);
                    try {
                      localStorage.setItem("semc-sky-paused", String(next));
                    } catch {
                      /* Optional preference only. */
                    }
                  }}
                >
                  {paused ? <PlayIcon size={17} /> : <PauseIcon size={17} />}
                  {paused ? "Play sky" : "Pause sky"}
                </button>
                <button
                  type="button"
                  aria-label="Rotate orbital view"
                  title="Rotate orbital view"
                  onClick={() => controller.current?.turn(0.22)}
                >
                  <ArrowClockwiseIcon size={18} />
                </button>
              </>
            )}
          </div>,
          controlsHost,
        )}
    </>
  );
}

export function OrbitalBackground() {
  const path = usePathname();
  return path === "/" || path === "/stemfest" ? (
    <OrbitalScene key={path} />
  ) : null;
}
