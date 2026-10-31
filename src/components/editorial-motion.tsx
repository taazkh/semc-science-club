"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

export function EditorialMotion() {
  useEffect(() => {
    document.documentElement.dataset.motionReady = "true";
  }, []);
  return null;
}

export function ChangingValue({
  value,
  className = "",
  direction = "dynamic",
}: {
  value: string | number;
  className?: string;
  direction?: "dynamic" | "up" | "down";
}) {
  const text = String(value);
  const previous = useRef(text);
  useEffect(() => {
    previous.current = text;
  }, [text]);
  let place = 0;
  const cells = Array.from(text)
    .reverse()
    .map((char, index) => {
      if (/\d/.test(char))
        return { char, digit: true, key: `digit-${place++}` };
      return { char, digit: false, key: `literal-${index}-${char}` };
    })
    .reverse();
  return (
    <span className={`changing-value animated-digits ${className}`}>
      <span className="sr-only">{text}</span>
      <span className="digit-cells" aria-hidden="true">
        {cells.map(({ char, digit, key }) =>
          digit ? (
            <DigitCell
              key={key}
              char={char}
              direction={direction}
              entering={previous.current !== text}
            />
          ) : (
            <span className="digit-literal" key={key}>
              {char}
            </span>
          ),
        )}
      </span>
    </span>
  );
}

function DigitCell({
  char,
  direction,
  entering,
}: {
  char: string;
  direction: "dynamic" | "up" | "down";
  entering: boolean;
}) {
  const current = useRef<HTMLSpanElement>(null),
    outgoing = useRef<HTMLSpanElement>(null);
  const previous = useRef(char);
  const mounted = useRef(false);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const before = previous.current;
    const added = entering && !mounted.current;
    mounted.current = true;
    previous.current = char;
    const incomingNode = current.current,
      outgoingNode = outgoing.current;
    if (
      (!added && before === char) ||
      reduced !== false ||
      !incomingNode ||
      !outgoingNode
    )
      return;
    outgoingNode.textContent = added ? "" : before;
    const sign =
      direction === "dynamic"
        ? Number(char) < Number(before)
          ? -1
          : 1
        : direction === "down"
          ? -1
          : 1;
    const options = {
      duration: 240,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "both" as FillMode,
    };
    const incomingEffect = incomingNode.animate(
      [
        { transform: `translateY(${sign * 100}%)`, opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      options,
    );
    const outgoingEffect = outgoingNode.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: `translateY(${-sign * 100}%)`, opacity: 0 },
      ],
      options,
    );
    return () => {
      incomingEffect.cancel();
      outgoingEffect.cancel();
    };
  }, [char, direction, reduced, entering]);
  return (
    <span className="digit-cell">
      <span className="digit-metric">0</span>
      <span className="digit-window">
        <span ref={outgoing} className="digit-outgoing" />
        <span ref={current} className="digit-current">
          {char}
        </span>
      </span>
    </span>
  );
}

export function LetterAccent({ text }: { text: string }) {
  return (
    <span className="letter-accent" aria-label={text}>
      {Array.from(text).map((letter, i) => (
        <span
          aria-hidden="true"
          key={i}
          style={
            {
              "--letter-delay": Math.min(i * 13, 130) + "ms",
            } as import("react").CSSProperties
          }
        >
          {letter === " " ? "\u00a0" : letter}
        </span>
      ))}
    </span>
  );
}
