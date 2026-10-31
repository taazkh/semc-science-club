"use client";

import { useEffect, useRef, useState } from "react";
import { ChangingValue } from "./editorial-motion";

export const festivalOpening = "2026-11-16T08:00:00+06:00";
const openingTimestamp = Date.parse(festivalOpening);

export function remainingFestivalTime(now: number) {
  const total = Math.max(0, Math.ceil((openingTimestamp - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    total,
  };
}

export function FestivalCountdown({ className = "" }: { className?: string }) {
  // A static schedule and reserved placeholders are identical on SSR/hydration.
  const [remaining, setRemaining] = useState<ReturnType<
    typeof remainingFestivalTime
  > | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let timer = 0;
    let visible = true;
    const stop = () => {
      window.clearTimeout(timer);
      timer = 0;
    };
    const update = () => {
      stop();
      const next = remainingFestivalTime(Date.now());
      setRemaining(next);
      if (next.total && visible && !document.hidden)
        timer = window.setTimeout(update, 1000 - (Date.now() % 1000) + 16);
    };
    const sync = () => {
      stop();
      if (visible && !document.hidden) update();
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            sync();
          });
    if (host.current) observer?.observe(host.current);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const description = remaining
    ? remaining.total
      ? `${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes and ${remaining.seconds} seconds until STEMfest opens.`
      : "STEMfest opening time has arrived."
    : "Countdown updates when this page is ready.";
  return (
    <div
      ref={host}
      className={`festival-countdown festival-countdown-full ${className}`}
    >
      <div className="countdown-schedule">
        <span>STEMfest opens</span>
        <time dateTime={festivalOpening}>16 November 2026 · 8:00 AM Dhaka</time>
      </div>
      <div className="countdown-timer" role="timer" aria-live="off">
        <span className="sr-only">{description}</span>
        <div className="countdown-units" aria-hidden="true">
          {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
            <div className="countdown-unit" key={unit}>
              <strong>
                {remaining ? (
                  <ChangingValue
                    value={String(remaining[unit]).padStart(2, "0")}
                    direction="down"
                  />
                ) : (
                  <span className="countdown-placeholder">––</span>
                )}
              </strong>
              <span>{unit}</span>
            </div>
          ))}
        </div>
      </div>
      {remaining?.total === 0 && (
        <p className="countdown-complete">The opening countdown is complete.</p>
      )}
    </div>
  );
}
