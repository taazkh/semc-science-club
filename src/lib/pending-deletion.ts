export type DeletionClock = {
  now: () => number;
  schedule: (callback: () => void, delay: number) => unknown;
  clear: (handle: unknown) => void;
};

export type PendingDeletion<T> = {
  token: number;
  operation: T;
  phase: "waiting" | "committing";
  remaining: number;
  paused: boolean;
};

export function deletionMatchesSelection(
  operation: { id: string; selectionGeneration: number },
  currentId: string | null | undefined,
  currentGeneration: number,
) {
  return (
    operation.id === currentId &&
    operation.selectionGeneration === currentGeneration
  );
}

const browserClock: DeletionClock = {
  now: () => performance.now(),
  schedule: (callback, delay) => setTimeout(callback, delay),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** A cancel window before the existing permanent-delete request is sent. */
export class PendingDeletionController<T> {
  private value: PendingDeletion<T> | null = null;
  private timer: unknown;
  private deadline = 0;
  private token = 0;
  private disposed = false;
  private pauses = new Set<string>();

  constructor(
    private onChange: (value: PendingDeletion<T> | null) => void,
    private commit: (value: PendingDeletion<T>) => Promise<unknown>,
    private clock: DeletionClock = browserClock,
    private delay = 5000,
  ) {}

  get snapshot() {
    return this.value;
  }

  isCurrent(token: number) {
    return !this.disposed && this.value?.token === token;
  }

  queue(operation: T) {
    if (this.disposed || this.value) return false;
    this.deadline = this.clock.now() + this.delay;
    this.value = {
      token: ++this.token,
      operation,
      phase: "waiting",
      remaining: this.delay,
      paused: this.pauses.size > 0,
    };
    this.publish();
    this.arm();
    return true;
  }

  cancel() {
    if (this.value?.phase !== "waiting") return false;
    this.stop();
    this.value = null;
    this.clearInteractionPauses();
    this.publish();
    return true;
  }

  pause(reason: string, active: boolean) {
    const wasPaused = this.pauses.size > 0;
    if (active) this.pauses.add(reason);
    else this.pauses.delete(reason);
    if (!this.value || this.value.phase !== "waiting") return;
    const paused = this.pauses.size > 0;
    if (paused === wasPaused) return;
    if (paused) {
      this.value.remaining = Math.max(0, this.deadline - this.clock.now());
      this.stop();
    } else {
      this.deadline = this.clock.now() + this.value.remaining;
    }
    this.value = { ...this.value, paused };
    this.publish();
    this.arm();
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.value = null;
    this.pauses.clear();
  }

  private publish() {
    if (!this.disposed) this.onChange(this.value ? { ...this.value } : null);
  }

  private clearInteractionPauses() {
    for (const reason of ["hover", "focus", "drag"]) this.pauses.delete(reason);
  }

  private stop() {
    if (this.timer !== undefined) this.clock.clear(this.timer);
    this.timer = undefined;
  }

  private arm() {
    this.stop();
    if (!this.value || this.value.phase !== "waiting" || this.value.paused)
      return;
    const token = this.value.token;
    this.timer = this.clock.schedule(
      () => {
        this.timer = undefined;
        if (!this.isCurrent(token) || this.value!.phase !== "waiting") return;
        const remaining = Math.max(0, this.deadline - this.clock.now());
        this.value = { ...this.value!, remaining };
        if (remaining > 0) {
          this.publish();
          this.arm();
          return;
        }
        this.value = { ...this.value, phase: "committing" };
        this.publish();
        const committing = { ...this.value };
        // Mark committing synchronously: cancellation can never race the request.
        void Promise.resolve()
          .then(() => {
            if (this.isCurrent(token)) return this.commit(committing);
          })
          .catch(() => {
            // The caller presents the request failure and reconciles server state.
          })
          .finally(() => {
            if (!this.isCurrent(token)) return;
            this.value = null;
            this.clearInteractionPauses();
            this.publish();
          });
      },
      Math.min(100, Math.max(0, this.deadline - this.clock.now())),
    );
  }
}
