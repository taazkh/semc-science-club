"use client";
import { useEffect, useRef, type RefObject } from "react";
import { MotionConfig } from "motion/react";

export function MotionPreferences({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

function reducedMotion() {
  return (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.input === "keyboard"
  );
}

// A single bounded fade confirms a changed view, without animating every keystroke.
export function useViewFeedback<T extends HTMLElement>(
  ref: RefObject<T | null>,
  value: unknown,
) {
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (!ref.current || reducedMotion()) return;
    const animation = ref.current.animate([{ opacity: 0.65 }, { opacity: 1 }], {
      duration: 180,
      easing: "cubic-bezier(.2,.8,.2,1)",
    });
    return () => animation.cancel();
  }, [ref, value]);
}

export function MotionFeedback() {
  useEffect(() => {
    const keyboard = () => {
      document.documentElement.dataset.input = "keyboard";
    };
    const pointer = () => {
      document.documentElement.dataset.input = "pointer";
    };
    const toggle = (event: Event) => {
      const detail = event.target;
      if (
        !(detail instanceof HTMLDetailsElement) ||
        !detail.open ||
        reducedMotion()
      )
        return;
      const content = detail.querySelector("p");
      if (content)
        content.animate(
          [
            { opacity: 0.5, transform: "translateY(-3px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
    };
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (preference.matches)
        document.getAnimations().forEach((animation) => animation.cancel());
    };
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("toggle", toggle, true);
    preference.addEventListener("change", stop);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("toggle", toggle, true);
      preference.removeEventListener("change", stop);
    };
  }, []);
  return null;
}
