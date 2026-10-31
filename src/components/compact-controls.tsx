"use client";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function Disclosure({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
        e.stopPropagation();
      }
    };
    document.addEventListener("pointerdown", outside);
    ref.current?.addEventListener("keydown", escape);
    const host = ref.current;
    return () => {
      document.removeEventListener("pointerdown", outside);
      host?.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      ref={ref}
      className={`compact-disclosure ${className}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.shiftKey && e.key === "F10") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label}
        <span aria-hidden="true">⌄</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            className="compact-popover"
            initial={reduced ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              if ((e.target as Element).closest("a,button")) setOpen(false);
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export function Tooltip({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({
    left: 0,
    top: 0,
    below: false,
    arrow: 0,
  });
  const tip = useRef<HTMLSpanElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const reduced = useReducedMotion();
  const clearHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const show = () => {
    clearHide();
    setOpen(true);
  };
  const hide = () => {
    clearHide();
    hideTimer.current = setTimeout(() => {
      if (!wrap.current?.contains(document.activeElement)) setOpen(false);
    }, 150);
  };
  useEffect(() => () => clearHide(), []);
  useLayoutEffect(() => {
    if (!open || !tip.current || !wrap.current) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      if (!tip.current || !wrap.current) return;
      const anchor = wrap.current.getBoundingClientRect();
      const width = tip.current.offsetWidth,
        height = tip.current.offsetHeight;
      const center = anchor.left + anchor.width / 2;
      const left = Math.max(
        8,
        Math.min(innerWidth - width - 8, center - width / 2),
      );
      const below = anchor.top - height - 8 < 8;
      setPlacement({
        left,
        top: below
          ? Math.min(innerHeight - height - 8, anchor.bottom + 8)
          : anchor.top - height - 8,
        below,
        arrow: Math.max(10, Math.min(width - 10, center - left)),
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const hidden = () => {
      if (document.hidden) {
        clearHide();
        setOpen(false);
      }
    };
    place();
    const resize = new ResizeObserver(schedule);
    resize.observe(wrap.current);
    resize.observe(tip.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [open, text]);
  return (
    <span
      ref={wrap}
      className="tooltip-wrap"
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          clearHide();
          setOpen(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          clearHide();
          setOpen(false);
          e.stopPropagation();
        }
      }}
    >
      {isValidElement<Record<string, unknown>>(children)
        ? cloneElement(children, {
            "aria-describedby":
              [children.props["aria-describedby"], open ? id : undefined]
                .filter(Boolean)
                .join(" ") || undefined,
          })
        : children}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.span
                ref={tip}
                id={id}
                className={`control-tooltip control-tooltip-portal is-visible${placement.below ? " is-below" : ""}`}
                role="tooltip"
                initial={
                  reduced !== false
                    ? false
                    : { opacity: 0, y: placement.below ? -4 : 4, scale: 0.95 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: placement.below ? -4 : 4,
                  scale: 0.95,
                  transition: {
                    duration: reduced !== false ? 0 : 0.15,
                    type: "tween",
                  },
                }}
                transition={{
                  type: "spring",
                  duration: reduced !== false ? 0 : 0.25,
                  bounce: 0.1,
                }}
                style={
                  {
                    left: placement.left,
                    top: placement.top,
                    "--tooltip-arrow": `${placement.arrow}px`,
                    transformOrigin: placement.below ? "top" : "bottom",
                  } as CSSProperties
                }
                onPointerEnter={clearHide}
                onPointerLeave={hide}
              >
                {text}
              </motion.span>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  );
}
