"use client";
import { useRef } from "react";
import { useReveal } from "@/lib/redesign/reveal";
const prepare = (node: HTMLSpanElement) =>
  Array.from(node.querySelectorAll(".kinetic-word")).map((word, index) =>
    word.animate(
      [
        { transform: "translateY(110%) rotate(2deg)", opacity: 0 },
        { transform: "translateY(0) rotate(0)", opacity: 1 },
      ],
      {
        duration: 560,
        delay: Math.min(index * 45, 280),
        easing: "cubic-bezier(.16,1,.3,1)",
        fill: "both",
      },
    ),
  );
export function KineticText({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  useReveal(ref, prepare);
  return (
    <span ref={ref} className="kinetic-text" data-reveal="pending">
      <span className="sr-only">{lines.join(" ")}</span>
      {lines.map((line, i) => (
        <span className="kinetic-line" key={`${i}-${line}`} aria-hidden="true">
          {line.split(" ").map((word, j) => (
            <span className="kinetic-mask" key={j}>
              <span className="kinetic-word">
                {word}
                {j < line.split(" ").length - 1 ? "\u00a0" : ""}
              </span>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
