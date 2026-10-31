"use client";
import { notify } from "./feedback-toast";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "./ui/button";
import { CheckCircleIcon, CopyIcon, XIcon } from "./icons";
export async function copyText(
  value: string,
  success = "Copied.",
  fallback = "Select the text and copy it manually.",
) {
  try {
    await navigator.clipboard.writeText(value);
    notify(success, "success");
    return true;
  } catch {
    notify(fallback, "error");
    return false;
  }
}
export function CopyConfirm({
  value,
  onResult,
  label = "Copy",
  success = "Private link copied.",
  fallback = "Select the link above and copy it manually.",
}: {
  value: string;
  onResult?: (message: string) => void;
  label?: string;
  success?: string;
  fallback?: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "copied" | "error">(
      "idle",
    ),
    reduced = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const Icon =
    state === "copied" ? CheckCircleIcon : state === "error" ? XIcon : CopyIcon;
  return (
    <Button
      type="button"
      variant="secondary"
      className="copy-confirm"
      data-state={state}
      disabled={state === "working"}
      onClick={async () => {
        if (timer.current) clearTimeout(timer.current);
        setState("working");
        const copied = await copyText(value, success, fallback);
        setState(copied ? "copied" : "error");
        onResult?.(copied ? success : fallback);
        timer.current = setTimeout(() => setState("idle"), 2500);
      }}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          className="copy-button-content"
          key={state}
          initial={reduced !== false ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced !== false ? { opacity: 0 } : { opacity: 0, y: -5 }}
          transition={{ duration: reduced !== false ? 0 : 0.12 }}
        >
          <Icon size={18} aria-hidden="true" />
          {state === "copied"
            ? "Copied"
            : state === "error"
              ? "Copy manually"
              : state === "working"
                ? "Copying…"
                : label}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
