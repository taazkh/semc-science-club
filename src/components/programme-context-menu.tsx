"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import { copyText } from "./copy-confirm";
import { Tooltip } from "./compact-controls";
import { ArrowRightIcon, BookOpenIcon, CaretDownIcon, CopyIcon } from "./icons";
import "./programme-context-menu.css";

export function ProgrammeContextMenu({
  children,
  programmeHref,
}: {
  children: ReactNode;
  programmeHref: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
      null,
    ),
    [focused, setFocused] = useState(0);
  const id = useId(),
    reduced = useReducedMotion();
  const open = position !== null;
  // Only public programme destinations can be shared, never a recovery URL.
  const browseHref =
    programmeHref === "/stemfest" ? programmeHref : "/stemfest#programme";
  const close = (restore = false) => {
    setPosition(null);
    if (restore) trigger.current?.focus({ preventScroll: true });
  };
  const show = (x: number, y: number, index = 0) => {
    setFocused(index);
    setPosition({ x: Math.max(8, x), y: Math.max(8, y) });
  };
  const showFromTrigger = (index = 0) => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) show(rect.left, rect.bottom + 6, index);
  };
  useLayoutEffect(() => {
    if (!position || !menu.current) return;
    const x = Math.max(
        8,
        Math.min(
          position.x,
          document.documentElement.clientWidth - menu.current.offsetWidth - 8,
        ),
      ),
      y = Math.max(
        8,
        Math.min(position.y, innerHeight - menu.current.offsetHeight - 8),
      );
    if (x !== position.x || y !== position.y) setPosition({ x, y });
  }, [position]);
  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelectorAll<HTMLElement>("[role='menuitem']")
      [focused]?.focus({ preventScroll: true });
  }, [open, focused]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        close();
    };
    const dismiss = () => close();
    const scroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("blur", dismiss);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  return (
    <div
      className="programme-context-surface"
      onContextMenu={(event) => {
        const target = event.target;
        if (
          !(target instanceof Element) ||
          target.closest(
            "a,button,input,textarea,select,summary,[contenteditable],[role='menu']",
          ) ||
          window.getSelection()?.toString()
        )
          return;
        event.preventDefault();
        show(event.clientX, event.clientY);
      }}
    >
      <div className="programme-context-tools">
        <Tooltip text="Copy the public programme link or jump to registration.">
          <button
            ref={trigger}
            type="button"
            className="programme-context-trigger"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            onClick={() => (open ? close() : showFromTrigger())}
            onKeyDown={(event) => {
              if (
                ["ArrowDown", "ArrowUp", "ContextMenu"].includes(event.key) ||
                (event.shiftKey && event.key === "F10")
              ) {
                event.preventDefault();
                showFromTrigger(event.key === "ArrowUp" ? 2 : 0);
              }
            }}
          >
            Programme actions <CaretDownIcon size={16} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {position && (
              <MenuPresence key="programme-actions">
                <motion.div
                  ref={menu}
                  id={id}
                  role="menu"
                  aria-label="Programme actions"
                  className="programme-context-menu"
                  style={{ left: position.x, top: position.y }}
                  initial={
                    reduced !== false
                      ? false
                      : { opacity: 0, y: -4, scale: 0.97 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced !== false ? 0 : 0.16 }}
                  onKeyDown={(event) => {
                    if (
                      ["ArrowDown", "ArrowUp", "Home", "End"].includes(
                        event.key,
                      )
                    ) {
                      event.preventDefault();
                      setFocused(
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 2
                            : (focused +
                                (event.key === "ArrowDown" ? 1 : -1) +
                                3) %
                              3,
                      );
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      close(true);
                    } else if (event.key === "Tab") close(true);
                    else if (
                      event.key === " " &&
                      event.target instanceof HTMLAnchorElement
                    ) {
                      event.preventDefault();
                      event.target.click();
                    }
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={focused === 0 ? 0 : -1}
                    onFocus={() => setFocused(0)}
                    onClick={() => {
                      close(true);
                      void copyText(
                        new URL(browseHref, window.location.origin).href,
                        "Programme link copied.",
                        "Open Browse all programmes, then copy the public address from your browser.",
                      );
                    }}
                  >
                    <CopyIcon size={18} aria-hidden="true" /> Copy programme
                    link
                  </button>
                  <a
                    href={browseHref}
                    role="menuitem"
                    tabIndex={focused === 1 ? 0 : -1}
                    onFocus={() => setFocused(1)}
                    onClick={() => close()}
                  >
                    <BookOpenIcon size={18} aria-hidden="true" /> Browse all
                    programmes
                  </a>
                  <a
                    href="/register"
                    role="menuitem"
                    tabIndex={focused === 2 ? 0 : -1}
                    onFocus={() => setFocused(2)}
                    onClick={() => close()}
                  >
                    <ArrowRightIcon size={18} aria-hidden="true" /> Registration
                  </a>
                </motion.div>
              </MenuPresence>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function MenuPresence({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  return (
    <div inert={!present} aria-hidden={!present}>
      {children}
    </div>
  );
}
