"use client";
import { useEffect, useRef, useState } from "react";
import { createRenderer } from "@/lib/redesign/renderer";
import { BusyIndicator } from "./busy-indicator";

export function HeroOrbits({
  verticalOffset = 0,
}: {
  verticalOffset?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof createRenderer>>(null);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const surface = host.current;
    const canvas = document.createElement("canvas");
    surface.append(canvas);
    setFallback(false);
    setReady(false);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const restore = () => renderer.current?.setEnabled(
      !media.matches && !document.documentElement.dataset.initialLoading,
    );
    const loadingTimer = setTimeout(() => setLoading(true), 200);
    const startFrame = requestAnimationFrame(() => {
      renderer.current = createRenderer(
        canvas,
        [0.63, 0.74, 0.86],
        () => setFallback(true),
        verticalOffset,
      );
      setReady(!!renderer.current);
      setLoading(false);
      clearTimeout(loadingTimer);
      restore();
    });
    media.addEventListener("change", restore);
    window.addEventListener("semc-initial-loading-complete", restore);
    const measured =
      location.hostname === "127.0.0.1" &&
      new URLSearchParams(location.search).has("orbit-diagnostics");
    const timer = measured
      ? setInterval(() => {
          if (document.hidden) return;
          const data = renderer.current?.inspect();
          if (!data) return;
          const samples = data.samples
            .filter((n) => n > 0)
            .sort((a, b) => a - b);
          setDiagnostics(
            `Renderers ${data.active} · Frames ${data.frames} · Time ${data.time.toFixed(2)} · Speed ${data.speed.toFixed(2)}× · Pitch ${data.pitch.toFixed(2)} · Distance ${data.distance.toFixed(2)} · Scroll ${Math.round(data.scrollProgress * 100)}% · ${data.particles} particles · ${(data.pixels / 1000000).toFixed(2)}M pixels · Median ${(samples[Math.floor(samples.length * 0.5)] ?? 0).toFixed(1)} ms / p95 ${(samples[Math.floor(samples.length * 0.95)] ?? 0).toFixed(1)} ms · ${data.running ? "Running" : "Still"}`,
          );
        }, 1000)
      : undefined;
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(startFrame);
      clearTimeout(loadingTimer);
      renderer.current?.dispose();
      renderer.current = null;
      canvas.remove();
      media.removeEventListener("change", restore);
      window.removeEventListener("semc-initial-loading-complete", restore);
      setLoading(false);
      setDiagnostics(null);
    };
  }, [verticalOffset]);
  return (
    <div className="hero-orbits" aria-hidden="true"
      data-scene-state={fallback ? "fallback" : ready ? "ready" : "pending"}>
      {diagnostics && (
        <output className="orbit-diagnostics">{diagnostics}</output>
      )}
      {loading && !ready && !fallback && (
        <div className="orbit-loading">
          <BusyIndicator size={64} label="Preparing background" />
        </div>
      )}
      <div className="orbit-fallback" hidden={ready && !fallback}>
        {[0, 1, 2, 3, 4].map((n) => (
          <i key={n} />
        ))}
        <b />
      </div>
      <div className="orbit-stage">
        <div ref={host} className="orbit-canvas-host" hidden={fallback} />
      </div>
    </div>
  );
}
