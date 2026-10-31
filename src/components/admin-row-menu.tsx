"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import { Button } from "./ui/button";
import { copyText } from "./copy-confirm";
import { CopyIcon, ArrowRightIcon } from "./icons";

export function AdminRowMenu({
  reference,
  onReview,
}: {
  reference: string;
  onReview: () => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const id = useId(),
    reduced = useReducedMotion();
  const close = (restore = false) => {
    setPosition(null);
    if (restore) (returnFocus.current || trigger.current)?.focus();
  };
  const show = (x: number, y: number, origin: HTMLElement | null) => {
    returnFocus.current = origin;
    setPosition({
      x: Math.max(8, Math.min(x, innerWidth - 236)),
      y: Math.max(8, Math.min(y, innerHeight - 136)),
    });
  };
  useEffect(() => {
    const row = trigger.current?.closest("tr");
    if (!row) return;
    const context = (event: MouseEvent) => {
      if ((event.target as Element).closest("input,textarea,a")) return;
      event.preventDefault();
      show(event.clientX, event.clientY, row);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        (event.shiftKey && event.key === "F10") ||
        event.key === "ContextMenu"
      ) {
        event.preventDefault();
        const box = trigger.current!.getBoundingClientRect();
        show(box.left, box.bottom + 6, document.activeElement as HTMLElement);
      }
    };
    row.addEventListener("contextmenu", context);
    row.addEventListener("keydown", keyboard);
    return () => {
      row.removeEventListener("contextmenu", context);
      row.removeEventListener("keydown", keyboard);
    };
  }, []);
  useEffect(() => {
    if (!position) return;
    const frame = requestAnimationFrame(() =>
      menu.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
    const outside = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        close();
    };
    const dismiss = () => close();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [position]);
  return (
    <>
      <Button
        ref={trigger}
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`More actions for ${reference}`}
        aria-haspopup="menu"
        aria-expanded={!!position}
        aria-controls={position ? id : undefined}
        onClick={() => {
          if (position) close();
          else {
            const box = trigger.current!.getBoundingClientRect();
            show(box.left, box.bottom + 6, trigger.current);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            const box = trigger.current!.getBoundingClientRect();
            show(box.left, box.bottom + 6, trigger.current);
          }
        }}
      >
        More <span aria-hidden="true">⌄</span>
      </Button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {position && (
              <MenuVisibility key="row-menu">
                <motion.div
                  ref={menu}
                  id={id}
                  role="menu"
                  aria-label={`Actions for ${reference}`}
                  className="admin-row-menu"
                  style={{
                    position: "fixed",
                    left: position.x,
                    top: position.y,
                  }}
                  initial={
                    reduced !== false
                      ? false
                      : { opacity: 0, y: -5, scale: 0.98 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduced !== false ? { opacity: 0 } : { opacity: 0, y: -3 }
                  }
                  transition={{ duration: reduced !== false ? 0 : 0.16 }}
                  onKeyDown={(event) => {
                    const controls = Array.from(
                      menu.current!.querySelectorAll<HTMLButtonElement>(
                        "button",
                      ),
                    );
                    const index = controls.indexOf(
                      document.activeElement as HTMLButtonElement,
                    );
                    if (
                      ["ArrowDown", "ArrowUp", "Home", "End"].includes(
                        event.key,
                      )
                    ) {
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? controls.length - 1
                            : (index +
                                (event.key === "ArrowDown" ? 1 : -1) +
                                controls.length) %
                              controls.length;
                      controls[next].focus();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      close(true);
                    } else if (event.key === "Tab") close(true);
                  }}
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      close(true);
                      onReview();
                    }}
                  >
                    Open review <ArrowRightIcon size={17} aria-hidden="true" />
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      close(true);
                      void copyText(
                        reference,
                        "Reference copied.",
                        "Select the reference in the Application column and copy it manually.",
                      );
                    }}
                  >
                    Copy reference <CopyIcon size={17} aria-hidden="true" />
                  </button>
                </motion.div>
              </MenuVisibility>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function MenuVisibility({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  return (
    <div inert={!present} aria-hidden={!present}>
      {children}
    </div>
  );
}
