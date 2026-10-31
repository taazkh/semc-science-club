"use client";

import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
} from "react";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import "./spring-check.css";

// React Bits SpringCheck's single spring drives the fill, swell and drawn tick.
const SWELL = 0.35;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const readings = (value: number) => ({
  fill: `scale(${Math.max(value, 0)})`,
  box: `scale(${1 + SWELL * Math.max(0, value - 1)})`,
  tick: 1 - clamp01(value),
});

export const SpringCheckbox = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<"input">
>(function SpringCheckbox(
  { checked, defaultChecked, disabled, className = "", onChange, ...props },
  forwardedRef,
) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(forwardedRef, () => input.current!, []);
  const [inner, setInner] = useState(!!defaultChecked);
  const on = !!(checked ?? inner);
  const reduce = useReducedMotion();
  const t = useMotionValue(on ? 1 : 0);
  const box = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const tick = useRef<SVGPathElement>(null);
  const row = useRef<HTMLSpanElement>(null);
  const write = (value: number) => {
    const r = readings(value);
    if (box.current) box.current.style.transform = r.box;
    if (fill.current) fill.current.style.transform = r.fill;
    if (tick.current) tick.current.style.strokeDashoffset = String(r.tick);
  };
  useMotionValueEvent(t, "change", write);
  useLayoutEffect(() => {
    write(t.get());
  });
  useEffect(() => {
    if (reduce !== false) {
      t.jump(on ? 1 : 0);
      return;
    }
    const control = animate(t, on ? 1 : 0, {
      type: "spring",
      duration: 0.24,
      bounce: 0.18,
    });
    return () => control.stop();
  }, [on, reduce, t]);
  const release = () => {
    if (row.current) delete row.current.dataset.pressed;
  };
  return (
    <span
      ref={row}
      className={`spring-check spring-check-native ${className}`}
      data-disabled={disabled || undefined}
      style={
        {
          "--sc-box": "22px",
          "--sc-radius": "6px",
          "--sc-fill": "var(--accent)",
          "--sc-check": "var(--bg)",
          "--sc-ink": "var(--accent)",
          "--sc-ring": "1.5px",
        } as CSSProperties
      }
      onPointerDown={(event) => {
        if (!disabled && event.button === 0 && row.current)
          row.current.dataset.pressed = "";
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onBlur={release}
    >
      <input
        {...props}
        ref={input}
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={(event) => {
          setInner(event.target.checked);
          onChange?.(event);
        }}
      />
      <span className="spring-check__press" aria-hidden="true">
        <span className="spring-check__box" ref={box}>
          <span className="spring-check__ring" />
          <span
            className="spring-check__fill"
            ref={fill}
            style={{ transform: `scale(${on ? 1 : 0})` }}
          />
          <svg className="spring-check__tick" viewBox="0 0 24 24">
            <path
              ref={tick}
              d="M20 6L9 17L4 12"
              pathLength="1"
              strokeDasharray="1"
              style={{ strokeDashoffset: on ? 0 : 1 }}
            />
          </svg>
        </span>
      </span>
    </span>
  );
});
