"use client";
import { useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MagnifyingGlassIcon, XIcon } from "./icons";
import { useSearchCaret } from "./search-caret";
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const host = useRef<HTMLSpanElement>(null),
    mirror = useRef<HTMLSpanElement>(null),
    caret = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const active = value.trim().length > 0;
  useSearchCaret(ref, host, mirror, caret, value);
  return (
    <div className="search-shell favicon-search" data-filled={active}>
      <span className="search-icon-slot" aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={active ? "local-favicon" : "search"}
            initial={
              reduced !== false
                ? false
                : { opacity: 0, scale: 0.65, rotate: -12 }
            }
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: reduced !== false ? 0 : 0.18 }}
          >
            {active ? (
              <img
                src="/brand/semc-science-club.png"
                alt=""
                width="24"
                height="24"
              />
            ) : (
              <MagnifyingGlassIcon size={20} />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="search-input-wrap" ref={host}>
        <input
          ref={ref}
          type="search"
          aria-label={label}
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="search-measure" ref={mirror} aria-hidden="true" />
        <span className="search-smooth-caret" ref={caret} aria-hidden="true" />
      </span>
      <span className="search-clear-slot">
        <AnimatePresence initial={false}>
          {value && (
            <motion.button
              type="button"
              aria-label={`Clear ${label.toLowerCase()}`}
              initial={reduced !== false ? false : { opacity: 0, scale: 0.65 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: reduced !== false ? 0 : 0.16 }}
              onClick={() => {
                onChange("");
                ref.current?.focus();
              }}
            >
              <XIcon size={17} />
            </motion.button>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}
