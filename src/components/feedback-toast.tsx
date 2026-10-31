"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { XIcon } from "./icons";
import StatusMark from "./react-bits/status-mark";
export type FeedbackTone = "info" | "success" | "error";
type Notice = { text: string; tone: FeedbackTone };
const redirectKey = "semc-action-feedback";
export function notify(text: string, tone: FeedbackTone = "info") {
  window.dispatchEvent(
    new CustomEvent("semc-toast", { detail: { text, tone } }),
  );
}
export function feedbackAfterNavigation(
  text: string,
  tone: FeedbackTone = "success",
) {
  try {
    sessionStorage.setItem(redirectKey, JSON.stringify({ text, tone }));
  } catch {
    /* The destination retains the saved state. */
  }
}
export function FeedbackToasts() {
  const [items, setItems] = useState<(Notice & { id: number })[]>([]),
    reduced = useReducedMotion();
  useEffect(() => {
    let counter = 0;
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const notice =
        typeof detail === "string"
          ? { text: detail, tone: "info" as const }
          : (detail as Notice);
      if (
        !notice ||
        typeof notice.text !== "string" ||
        !["info", "success", "error"].includes(notice.tone)
      )
        return;
      const id = ++counter;
      setItems((old) => [...old.slice(-2), { ...notice, id }]);
      timers.set(
        id,
        setTimeout(() => {
          setItems((old) => old.filter((item) => item.id !== id));
          timers.delete(id);
        }, 5000),
      );
    };
    window.addEventListener("semc-toast", receive);
    try {
      const saved = sessionStorage.getItem(redirectKey);
      sessionStorage.removeItem(redirectKey);
      if (saved)
        receive(new CustomEvent("semc-toast", { detail: JSON.parse(saved) }));
    } catch {
      /* Toast enhancement must not block recovery or status. */
    }
    return () => {
      window.removeEventListener("semc-toast", receive);
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            className="feedback-toast"
            data-tone={item.tone}
            key={item.id}
            initial={
              reduced !== false ? false : { opacity: 0, y: 12, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced !== false ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: reduced !== false ? 0 : 0.2 }}
          >
            {item.tone !== "info" && (
              <span aria-hidden="true">
                <StatusMark
                  status={item.tone === "success" ? "done" : "failed"}
                  size={20}
                />
              </span>
            )}
            <span>{item.text}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() =>
                setItems((old) => old.filter((notice) => notice.id !== item.id))
              }
            >
              <XIcon size={18} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
