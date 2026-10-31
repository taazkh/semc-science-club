"use client";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AriaAttributes,
  type FocusEventHandler,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { CaretDownIcon, CheckIcon } from "../icons";
import { cn } from "@/lib/utils";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
export function AnimatedDropdown({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className,
  name,
  required = false,
  id: suppliedId,
  form,
  autoComplete,
  onBlur,
  invalid,
  describedBy,
  "aria-labelledby": labelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly DropdownOption[];
  disabled?: boolean;
  className?: string;
  name?: string;
  required?: boolean;
  id?: string;
  form?: string;
  autoComplete?: string;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  invalid?: boolean;
  describedBy?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
}) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLUListElement>(null),
    native = useRef<HTMLSelectElement>(null);
  const [nativeInvalid, setNativeInvalid] = useState(false);
  useLayoutEffect(() => {
    if (nativeInvalid && native.current?.validity.valid)
      setNativeInvalid(false);
  });
  const openRef = useRef(false);
  const [open, setOpen] = useState(false),
    [visible, setVisible] = useState(false),
    [focused, setFocused] = useState(0);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 180,
    maxHeight: 304,
    above: false,
  });
  const typeahead = useRef(""),
    typeaheadTime = useRef(0);
  const reduced = useReducedMotion();
  const selected = options.find((option) => option.value === value);
  const available = options.flatMap((option, index) =>
    option.disabled ? [] : [index],
  );
  const step = (from: number, movement: number) => {
    const position = available.indexOf(from);
    return (
      available[(position + movement + available.length) % available.length] ??
      0
    );
  };
  const close = (restore = false) => {
    openRef.current = false;
    setOpen(false);
    if (restore) button.current?.focus();
  };
  const show = (
    index = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  ) => {
    if (disabled || !available.length) return;
    openRef.current = true;
    setFocused(options[index]?.disabled ? available[0] : index);
    typeahead.current = "";
    setVisible(true);
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open) return;
    if (disabled || !available.length) {
      close();
      return;
    }
    const place = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 180), innerWidth - 16);
      const expected = Math.min(options.length * 44 + 12, 304);
      const below = innerHeight - rect.bottom - 12,
        above = rect.top - 12;
      const flips = below < Math.min(expected, 176) && above > below;
      const maxHeight = Math.max(44, Math.min(304, flips ? above : below));
      setPosition({
        width,
        maxHeight,
        above: flips,
        left: Math.max(8, Math.min(innerWidth - width - 8, rect.left)),
        top: flips
          ? Math.max(8, rect.top - Math.min(expected, maxHeight) - 6)
          : rect.bottom + 6,
      });
    };
    const outside = (event: PointerEvent) => {
      if (
        !button.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        close();
    };
    const blur = (event: FocusEvent) => {
      if (
        !button.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        close();
    };
    place();
    setFocused((previous) =>
      options[previous] && !options[previous].disabled
        ? previous
        : available[0],
    );
    panel.current?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", blur);
    const resize = new ResizeObserver(place);
    if (button.current) resize.observe(button.current);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", blur);
      resize.disconnect();
    };
  }, [open, disabled, options]);
  useLayoutEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${focused}`)
        ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [open, focused, id]);
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (native.current) {
      native.current.value = option.value;
      native.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setNativeInvalid(false);
    onChange(option.value);
    close(true);
  };
  const keydown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) show(event.key === "ArrowUp" ? available.at(-1) : undefined);
      else
        setFocused((previous) =>
          step(previous, event.key === "ArrowDown" ? 1 : -1),
        );
    } else if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      setFocused(event.key === "Home" ? available[0] : (available.at(-1) ?? 0));
    } else if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      choose(focused);
    } else if (
      open &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const now = performance.now();
      typeahead.current =
        (now - typeaheadTime.current > 700 ? "" : typeahead.current) +
        event.key.toLocaleLowerCase();
      typeaheadTime.current = now;
      const found = options.findIndex(
        (option) =>
          !option.disabled &&
          option.label.toLocaleLowerCase().startsWith(typeahead.current),
      );
      if (found >= 0) setFocused(found);
    }
  };
  return (
    <div
      className={cn("animated-dropdown", className)}
      data-invalid={nativeInvalid || invalid || ariaInvalid || undefined}
    >
      <span
        className={labelledBy ? "dropdown-label sr-only" : "dropdown-label"}
        id={`${id}-label`}
      >
        {label}
      </span>
      <button
        type="button"
        className="dropdown-trigger"
        id={id}
        role="combobox"
        ref={button}
        disabled={disabled}
        aria-labelledby={`${labelledBy || `${id}-label`} ${id}-value`}
        aria-describedby={ariaDescribedBy || describedBy}
        aria-invalid={ariaInvalid || invalid || nativeInvalid || undefined}
        aria-required={required || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={visible ? `${id}-list` : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={keydown}
        onBlur={onBlur}
      >
        <span id={`${id}-value`}>{selected?.label ?? "Choose an option"}</span>
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduced !== false ? 0 : 0.18 }}
        >
          <CaretDownIcon size={18} />
        </motion.span>
      </button>
      <select
        className="dropdown-native"
        ref={native}
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        disabled={disabled}
        value={value}
        form={form}
        autoComplete={autoComplete}
        onChange={(event) => {
          setNativeInvalid(false);
          onChange(event.target.value);
        }}
        onInvalid={(event) => {
          event.preventDefault();
          setNativeInvalid(true);
          const firstInvalid = event.currentTarget.form?.querySelector(
            "input:invalid, select:invalid, textarea:invalid",
          );
          if (!firstInvalid || firstInvalid === event.currentTarget)
            button.current?.focus();
        }}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {visible &&
        typeof document !== "undefined" &&
        createPortal(
          <motion.div
            className="dropdown-portal"
            inert={!open}
            aria-hidden={!open}
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              transformOrigin: position.above ? "bottom" : "top",
            }}
            initial={
              reduced !== false
                ? false
                : { opacity: 0, y: position.above ? 6 : -6, scaleY: 0.94 }
            }
            animate={{
              opacity: open ? 1 : 0,
              y: open ? 0 : position.above ? 6 : -6,
              scaleY: open ? 1 : 0.94,
            }}
            transition={{
              duration: reduced !== false ? 0 : 0.18,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            onAnimationComplete={() => {
              if (!openRef.current) setVisible(false);
            }}
          >
            <ul
              className="dropdown-options"
              ref={panel}
              id={`${id}-list`}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={`${id}-label`}
              aria-activedescendant={`${id}-option-${focused}`}
              style={{ maxHeight: position.maxHeight }}
              onKeyDown={keydown}
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  data-focused={index === focused}
                  onPointerMove={() => {
                    if (!option.disabled) setFocused(index);
                  }}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <CheckIcon size={18} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          </motion.div>,
          document.body,
        )}
    </div>
  );
}
