"use client";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { animate, useReducedMotion } from "motion/react";

export function useSearchCaret(
  inputRef: RefObject<HTMLInputElement | null>,
  hostRef: RefObject<HTMLSpanElement | null>,
  mirrorRef: RefObject<HTMLSpanElement | null>,
  caretRef: RefObject<HTMLSpanElement | null>,
  value: string,
) {
  const reduced = useReducedMotion();
  const scheduleRef = useRef<() => void>(() => {});
  useLayoutEffect(() => scheduleRef.current(), [value]);
  useEffect(() => {
    const input = inputRef.current,
      host = hostRef.current;
    const mirror = mirrorRef.current,
      caret = caretRef.current;
    if (!input || !host || !mirror || !caret) return;
    let frame = 0,
      composing = false,
      touching = false,
      alive = true,
      first = true,
      snap = false;
    let lastX = 0;
    let animation: ReturnType<typeof animate> | undefined;
    const coarse = matchMedia("(hover: none), (pointer: coarse)");
    const native = () => {
      animation?.stop();
      caret.style.opacity = "0";
      input.style.caretColor = "";
      host.dataset.caret = "native";
      first = true;
    };
    const measure = () => {
      frame = 0;
      const start = input.selectionStart,
        end = input.selectionEnd;
      if (
        reduced !== false ||
        document.hidden ||
        document.activeElement !== input ||
        composing ||
        touching ||
        coarse.matches ||
        start === null ||
        end === null ||
        start !== end
      ) {
        native();
        return;
      }
      const styles = getComputedStyle(input);
      if (styles.direction !== "ltr" || /[\u0590-\u08ff]/.test(input.value)) {
        native();
        return;
      }
      mirror.style.font = styles.font;
      mirror.style.lineHeight = styles.lineHeight;
      mirror.style.fontVariant = styles.fontVariant;
      mirror.style.letterSpacing = styles.letterSpacing;
      mirror.style.wordSpacing = styles.wordSpacing;
      mirror.style.fontKerning = styles.fontKerning;
      mirror.style.fontFeatureSettings = styles.fontFeatureSettings;
      mirror.style.fontVariationSettings = styles.fontVariationSettings;
      mirror.style.textTransform = styles.textTransform;
      mirror.textContent = input.value;
      let textX = 0;
      if (input.value) {
        const text = mirror.firstChild;
        if (!text) {
          native();
          return;
        }
        const range = document.createRange();
        range.setStart(text, Math.min(start, text.textContent?.length ?? 0));
        range.collapse(true);
        const bounds = range.getBoundingClientRect();
        if (!bounds.height || !Number.isFinite(bounds.left)) {
          native();
          return;
        }
        textX = bounds.left - mirror.getBoundingClientRect().left;
      }
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      const border = parseFloat(styles.borderLeftWidth) || 0;
      const absoluteX = paddingLeft + border + textX;
      const x = absoluteX - input.scrollLeft;
      const min = paddingLeft + border;
      const max = input.clientWidth + border - paddingRight - 1;
      if (x < min - 1 || x > max + 1 || !Number.isFinite(x)) {
        native();
        return;
      }
      const height = (parseFloat(styles.fontSize) || 16) * 0.92;
      const y = Math.max(0, (input.offsetHeight - height) / 2);
      caret.style.height = `${height}px`;
      const targetX = Math.max(min, Math.min(max, x));
      const target = `translate(${targetX}px, ${y}px)`;
      animation?.stop();
      if (first || snap || Math.abs(targetX - lastX) > height * 1.8)
        caret.style.transform = target;
      else
        animation = animate(
          caret,
          { transform: target, opacity: [0.12, 0.2, 1] },
          { duration: 0.12, times: [0, 0.7, 1], ease: [0.2, 0.8, 0.2, 1] },
        );
      caret.style.opacity = "1";
      input.style.caretColor = "transparent";
      host.dataset.caret = "smooth";
      lastX = targetX;
      first = false;
      snap = false;
    };
    const schedule = () => {
      if (!frame && alive) frame = requestAnimationFrame(measure);
    };
    scheduleRef.current = schedule;
    const pointer = (event: PointerEvent) => {
      touching = event.pointerType === "touch";
      snap = true;
      schedule();
    };
    const compositionStart = () => {
      composing = true;
      native();
    };
    const compositionEnd = () => {
      composing = false;
      snap = true;
      schedule();
    };
    const blur = () => native();
    const events = [
      "input",
      "keyup",
      "click",
      "select",
      "scroll",
      "focus",
    ] as const;
    events.forEach((event) => input.addEventListener(event, schedule));
    input.addEventListener("blur", blur);
    input.addEventListener("pointerdown", pointer);
    input.addEventListener("compositionstart", compositionStart);
    input.addEventListener("compositionend", compositionEnd);
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("visibilitychange", schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    void document.fonts.ready.then(() => {
      if (alive) schedule();
    });
    const observer = new ResizeObserver(() => {
      snap = true;
      schedule();
    });
    observer.observe(input);
    coarse.addEventListener("change", schedule);
    schedule();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      native();
      scheduleRef.current = () => {};
      events.forEach((event) => input.removeEventListener(event, schedule));
      input.removeEventListener("blur", blur);
      input.removeEventListener("pointerdown", pointer);
      input.removeEventListener("compositionstart", compositionStart);
      input.removeEventListener("compositionend", compositionEnd);
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("visibilitychange", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
      observer.disconnect();
      coarse.removeEventListener("change", schedule);
    };
  }, [reduced, inputRef, hostRef, mirrorRef, caretRef]);
}
