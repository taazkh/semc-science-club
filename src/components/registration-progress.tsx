"use client";
import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
const labels = ["Choose segments", "Participant details", "Review & save"];
export function RegistrationProgress({
  step,
  onChange,
  busy = false,
}: {
  step: number;
  onChange?: (step: number) => void;
  busy?: boolean;
}) {
  const id = useId(),
    reduced = useReducedMotion();
  return (
    <ol className="registration-progress" aria-label="Registration progress">
      {labels.map((label, index) => (
        <li
          key={label}
          aria-current={step === index ? "step" : undefined}
          data-complete={index < step}
        >
          {index > 0 && (
            <span className="step-connector" aria-hidden="true">
              <motion.i
                animate={{ scaleX: index <= step ? 1 : 0 }}
                initial={false}
                transition={{ duration: reduced !== false ? 0 : 0.24 }}
              />
            </span>
          )}
          <button
            type="button"
            disabled={busy || index >= step || !onChange}
            onClick={() => onChange?.(index)}
            aria-label={index < step ? `Edit ${label.toLowerCase()}` : label}
          >
            <span className="progress-index" aria-hidden="true">
              {index < step ? (
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <motion.path
                    d="m5 12 4 4L19 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={reduced !== false ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.22 }}
                  />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span className="step-label">
              {label}
              <small>
                {index < step
                  ? "Complete · edit"
                  : index === step
                    ? "Current step"
                    : "Up next"}
              </small>
            </span>
          </button>
          {step === index && (
            <motion.i
              className="step-current-plate"
              aria-hidden="true"
              layoutId={reduced !== false ? undefined : `${id}-step`}
              transition={{ duration: 0.22 }}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
