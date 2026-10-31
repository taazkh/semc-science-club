"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PlusIcon } from "./icons";

export function MotionAccordion({
  items,
  initialOpen = -1,
}: {
  items: readonly (readonly [string, string])[];
  initialOpen?: number;
}) {
  const [open, setOpen] = useState(initialOpen);
  const id = useId();
  return (
    <>
      <div className="controlled-accordion">
        {items.map(([title, body], index) => (
          <Answer
            key={title}
            title={title}
            body={body}
            open={index === open}
            toggle={() =>
              setOpen((previous) => (previous === index ? -1 : index))
            }
            id={`${id}-${index}`}
          />
        ))}
      </div>
      <noscript>
        <style>{".controlled-accordion{display:none}"}</style>
        <dl className="accordion-static">
          {items.map(([title, body]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </noscript>
    </>
  );
}

function Answer({
  title,
  body,
  open,
  toggle,
  id,
}: {
  title: string;
  body: string;
  open: boolean;
  toggle: () => void;
  id: string;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => setHeight(node.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [body]);
  const duration = reduced !== false ? 0 : 0.24;
  return (
    <section className="motion-accordion" data-open={open}>
      <h3 className="accordion-heading">
        <button
          className="accordion-trigger"
          type="button"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={toggle}
        >
          <span className="accordion-question">{title}</span>
          <motion.span
            className="accordion-icon"
            aria-hidden="true"
            initial={false}
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration }}
          >
            <PlusIcon size={22} />
          </motion.span>
        </button>
      </h3>
      <motion.div
        className="accordion-panel"
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-trigger`}
        aria-hidden={!open}
        inert={!open}
        initial={false}
        animate={{
          height: open ? (height ?? "auto") : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="accordion-body" ref={content}>
          <p>{body}</p>
        </div>
      </motion.div>
    </section>
  );
}
