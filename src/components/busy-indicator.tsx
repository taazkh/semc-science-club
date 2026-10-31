"use client";
import StatusMark from "./react-bits/status-mark";
export function BusyIndicator({
  label = "Please wait…",
  size = 32,
}: {
  label?: string;
  size?: 20 | 32 | 64;
  state?: "working" | "searching" | "solving";
}) {
  return (
    <span className="busy-indicator" role="status">
      <StatusMark
        status="running"
        size={Math.min(size, 24)}
        label={label}
        strike={false}
      />
    </span>
  );
}
