"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { AnimatedDropdown } from "./animated-dropdown";
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("input", className)} {...props} />;
}
export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return <textarea className={cn("input", className)} {...props} />;
}
export function Field({
  label,
  children,
  hint,
  error,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  className?: string;
}) {
  const id = React.useId();
  const field = React.useRef<HTMLLabelElement>(null);
  const [nativeError, setNativeError] = React.useState("");
  React.useLayoutEffect(() => {
    if (!nativeError || !field.current) return;
    const controls = field.current.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea");
    if (
      Array.from(controls).every(
        (control) => !control.willValidate || control.validity.valid,
      )
    )
      setNativeError("");
  });
  const reduced = useReducedMotion();
  const message = error || nativeError;
  let firstId: string | undefined;
  let controlIndex = 0;
  function decorate(nodes: React.ReactNode): React.ReactNode {
    return React.Children.map(nodes, (child) => {
      if (!React.isValidElement<Record<string, unknown>>(child)) return child;
      const control =
        child.type === Input ||
        child.type === Textarea ||
        child.type === AnimatedDropdown ||
        ["input", "select", "textarea"].includes(String(child.type));
      if (control) {
        const controlId =
          typeof child.props.id === "string"
            ? child.props.id
            : `${id}-input-${controlIndex++}`;
        firstId ??= controlId;
        return React.cloneElement(child, {
          id: controlId,
          "aria-labelledby": child.props["aria-labelledby"] || `${id}-label`,
          "aria-describedby":
            [
              child.props["aria-describedby"],
              hint && `${id}-hint`,
              message && `${id}-error`,
            ]
              .filter(Boolean)
              .join(" ") || undefined,
          "aria-invalid": message ? true : child.props["aria-invalid"],
        });
      }
      if (child.props.children)
        return React.cloneElement(child, {
          children: decorate(child.props.children as React.ReactNode),
        });
      return child;
    });
  }
  const controls = decorate(children);
  return (
    <label
      ref={field}
      className={cn("field", className)}
      htmlFor={firstId}
      data-invalid={!!message}
      onInvalidCapture={(event) => {
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLTextAreaElement
        )
          setNativeError(target.validationMessage);
      }}
      onInputCapture={(event) => {
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLTextAreaElement
        ) {
          if (nativeError)
            setNativeError(
              target.validity.valid ? "" : target.validationMessage,
            );
        }
      }}
    >
      <span id={`${id}-label`}>{label}</span>
      {controls}
      {hint && (
        <small id={`${id}-hint`} className="field-description">
          {hint}
        </small>
      )}
      <AnimatePresence initial={false}>
        {message && (
          <motion.small
            key="error"
            id={`${id}-error`}
            className="field-error"
            role="alert"
            initial={reduced !== false ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced !== false ? 0 : 0.18 }}
          >
            {message}
          </motion.small>
        )}
      </AnimatePresence>
    </label>
  );
}
