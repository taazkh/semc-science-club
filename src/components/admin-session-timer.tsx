"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { idleRemaining } from "@/lib/admin-idle";

export function AdminSessionTimer({
  initialExpiresAt,
}: {
  initialExpiresAt: number;
}) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [error, setError] = useState("");
  const keep = useRef<() => void>(() => {});
  const leave = useRef<() => void>(() => {});
  useEffect(() => {
    let cancelled = false,
      ending = false,
      inFlight = false,
      expires = initialExpiresAt,
      offset = 0,
      lastTouch = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("semc-admin-session")
        : null;
    const broadcast = (type: string) => {
      channel?.postMessage(type);
      try {
        localStorage.setItem(
          "semc-admin-session-event",
          JSON.stringify({ type, at: Date.now() }),
        );
      } catch {
        /* Optional tab signalling. */
      }
    };
    async function logout(expired = true, tell = true) {
      if (ending) return;
      ending = true;
      document.documentElement.dataset.adminExpired = "true";
      if (tell) broadcast("logout");
      try {
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        /* Server expiry still denies access when the network is unavailable. */
      } finally {
        if (!cancelled)
          window.location.replace(
            "/admin/login" + (expired ? "?reason=inactive" : ""),
          );
      }
    }
    async function sync(touch = false) {
      if (inFlight || ending || cancelled) return;
      inFlight = true;
      const deadlinePassed = idleRemaining(expires, Date.now() + offset) === 0;
      if (deadlinePassed)
        document.documentElement.dataset.adminExpired = "true";
      try {
        const response = await fetch("/api/admin/session", {
          ...(touch
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
                cache: "no-store" as const,
              }
            : { cache: "no-store" as const }),
          signal: AbortSignal.timeout(5000),
        });
        if (response.status === 401 || response.status === 403) {
          void logout();
          return;
        }
        const value = await response.json();
        if (!response.ok || !value.expiresAt)
          throw new Error("Session check failed");
        offset = value.serverNow - Date.now();
        expires = value.expiresAt;
        if (idleRemaining(expires, Date.now() + offset) === 0) {
          void logout();
          return;
        }
        document.documentElement.removeAttribute("data-admin-expired");
        if (!cancelled) {
          setSeconds(idleRemaining(expires, Date.now() + offset));
          setError("");
        }
        if (touch) {
          lastTouch = Date.now();
          broadcast("activity");
        }
      } catch {
        if (deadlinePassed || idleRemaining(expires, Date.now() + offset) === 0)
          void logout();
        else if (!cancelled)
          setError(
            "Connection interrupted. Save when connected; the inactivity limit still applies.",
          );
      } finally {
        inFlight = false;
      }
    }
    function activity(event: Event) {
      if (!event.isTrusted || document.visibilityState !== "visible" || ending)
        return;
      if (expires && idleRemaining(expires, Date.now() + offset) === 0) {
        void sync();
        return;
      }
      if (Date.now() - lastTouch >= 15000) {
        void sync(true);
      } else if (!pending)
        pending = setTimeout(
          () => {
            pending = undefined;
            if (document.visibilityState === "visible") void sync(true);
          },
          15000 - (Date.now() - lastTouch),
        );
    }
    function resumed() {
      if (document.visibilityState === "visible") void sync();
    }
    function received(type: string) {
      if (type === "logout") void logout(true, false);
      else if (type === "activity") void sync();
    }
    const storage = (event: StorageEvent) => {
      if (event.key === "semc-admin-session-event" && event.newValue) {
        try {
          received(JSON.parse(event.newValue).type);
        } catch {}
      }
    };
    const expiredEvent = () => {
      void logout();
    };
    const signoutEvent = () => {
      void logout(false);
    };
    keep.current = () => {
      void sync(true);
    };
    leave.current = () => {
      void logout(false);
    };
    document.documentElement.removeAttribute("data-admin-expired");
    void sync();
    const interval = setInterval(() => {
      if (!expires || ending) return;
      const remaining = idleRemaining(expires, Date.now() + offset);
      setSeconds(remaining);
      // Check the server before expiry, in case another tab extended the session.
      if (remaining === 0) void sync();
    }, 1000);
    const events = ["keydown", "pointerdown", "touchstart", "scroll"];
    events.forEach((type) =>
      document.addEventListener(type, activity, {
        passive: true,
        capture: true,
      }),
    );
    document.addEventListener("visibilitychange", resumed);
    window.addEventListener("storage", storage);
    window.addEventListener("semc-admin-expired", expiredEvent);
    window.addEventListener("semc-admin-logout", signoutEvent);
    window.addEventListener("pageshow", resumed);
    if (channel) channel.onmessage = (event) => received(event.data);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(pending);
      channel?.close();
      events.forEach((type) =>
        document.removeEventListener(type, activity, true),
      );
      document.removeEventListener("visibilitychange", resumed);
      window.removeEventListener("storage", storage);
      window.removeEventListener("semc-admin-expired", expiredEvent);
      window.removeEventListener("semc-admin-logout", signoutEvent);
      window.removeEventListener("pageshow", resumed);
    };
  }, [initialExpiresAt]);
  return (
    <div className="admin-session">
      <span className="session-clock">
        {seconds === null
          ? "Checking session…"
          : `Auto logout in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
      </span>
      {seconds !== null && seconds <= 60 && (
        <div className="session-warning" role="alert">
          <p>
            You’ll be signed out after five minutes of inactivity. Unsaved edits
            will be lost.
          </p>
          <div className="editor-actions">
            <Button size="sm" onClick={() => keep.current()}>
              Stay signed in
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => leave.current()}
            >
              Sign out
            </Button>
          </div>
        </div>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}
