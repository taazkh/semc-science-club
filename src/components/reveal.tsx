"use client";
import { useRef, type ReactNode } from "react";
import { useReveal } from "@/lib/redesign/reveal";
const enter = (node: HTMLDivElement) => [
  node.animate(
    [
      { opacity: 0, transform: "translateY(20px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 600, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" },
  ),
];
export function Reveal({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, enter);
  return (
    <div ref={ref} id={id} className={className} data-reveal="pending">
      {children}
    </div>
  );
}
