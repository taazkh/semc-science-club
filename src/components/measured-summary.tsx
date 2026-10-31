"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export function MeasuredSummary({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    const measure = () => setHeight(node.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div
      className="summary-expansion"
      initial={false}
      animate={{ height: height ?? "auto" }}
      transition={{
        duration: reduced !== false ? 0 : 0.24,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      <div className="summary-natural-list" ref={inner}>
        {children}
      </div>
    </motion.div>
  );
}
