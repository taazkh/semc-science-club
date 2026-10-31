"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type AnimatedCheckboxProps = ComponentPropsWithoutRef<"input"> & {
  indeterminate?: boolean;
};
export const AnimatedCheckbox = forwardRef<
  HTMLInputElement,
  AnimatedCheckboxProps
>(function AnimatedCheckbox(
  {
    checked,
    defaultChecked,
    indeterminate = false,
    className,
    onChange,
    ...props
  },
  ref,
) {
  const input = useRef<HTMLInputElement>(null);
  const [localChecked, setLocalChecked] = useState(!!defaultChecked);
  const reduced = useReducedMotion();
  const active = checked ?? localChecked;
  useImperativeHandle(ref, () => input.current!, []);
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <span
      className={cn("animated-checkbox", className)}
      data-state={indeterminate ? "mixed" : active ? "checked" : "unchecked"}
      data-disabled={props.disabled || undefined}
    >
      <input
        {...props}
        ref={input}
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        aria-checked={indeterminate ? "mixed" : props["aria-checked"]}
        onChange={(event) => {
          setLocalChecked(event.target.checked);
          onChange?.(event);
        }}
      />
      <span className="checkbox-visual" aria-hidden="true">
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          initial={false}
          animate={{
            opacity: active || indeterminate ? 1 : 0,
            scale: active || indeterminate ? 1 : 0.8,
          }}
          transition={{ duration: reduced !== false ? 0 : 0.18 }}
        >
          <motion.path
            key={indeterminate ? "mixed" : "check"}
            d={indeterminate ? "M5 12H19" : "M20 6L9 17L4 12"}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: active || indeterminate ? 1 : 0 }}
            transition={{ duration: reduced !== false ? 0 : 0.2 }}
          />
        </motion.svg>
      </span>
    </span>
  );
});
