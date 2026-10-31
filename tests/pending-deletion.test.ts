import assert from "node:assert/strict";
import test from "node:test";
import {
  PendingDeletionController,
  deletionMatchesSelection,
  type DeletionClock,
  type PendingDeletion,
} from "../src/lib/pending-deletion";

class FakeClock implements DeletionClock {
  time = 0;
  sequence = 0;
  timers = new Map<number, { at: number; callback: () => void }>();
  now = () => this.time;
  schedule = (callback: () => void, delay: number) => {
    const id = ++this.sequence;
    this.timers.set(id, { at: this.time + delay, callback });
    return id;
  };
  clear = (handle: unknown) => {
    this.timers.delete(handle as number);
  };
  advance(duration: number) {
    const target = this.time + duration;
    for (;;) {
      const next = [...this.timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      this.time = next[1].at;
      this.timers.delete(next[0]);
      next[1].callback();
    }
    this.time = target;
  }
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

test("cancelling just before expiry sends no deletion and permits a new queue", async () => {
  const clock = new FakeClock();
  const requests: string[] = [];
  const controller = new PendingDeletionController<string>(
    () => {},
    async ({ operation }) => {
      requests.push(operation);
    },
    clock,
  );
  assert.equal(controller.queue("A"), true);
  assert.equal(controller.queue("B"), false);
  clock.advance(4999);
  assert.equal(controller.cancel(), true);
  clock.advance(10000);
  await settle();
  assert.deepEqual(requests, []);
  assert.equal(controller.queue("B"), true);
  clock.advance(5000);
  await settle();
  assert.deepEqual(requests, ["B"]);
});

test("hover, focus and hidden pauses compose without consuming the cancel window", async () => {
  const clock = new FakeClock();
  let calls = 0;
  const controller = new PendingDeletionController(
    () => {},
    async () => {
      calls++;
    },
    clock,
  );
  controller.queue("A");
  clock.advance(1200);
  controller.pause("hover", true);
  controller.pause("focus", true);
  controller.pause("hidden", true);
  clock.advance(30000);
  assert.equal(controller.snapshot?.remaining, 3800);
  controller.pause("hover", false);
  controller.pause("focus", false);
  clock.advance(30000);
  assert.equal(calls, 0);
  controller.pause("hidden", false);
  clock.advance(3799);
  await settle();
  assert.equal(calls, 0);
  clock.advance(1);
  await settle();
  assert.equal(calls, 1);
});

test("the deadline locks cancellation and repeated attempts while committing", async () => {
  const clock = new FakeClock();
  let finish!: () => void;
  const request = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const committed: PendingDeletion<string>[] = [];
  const controller = new PendingDeletionController<string>(
    () => {},
    async (value) => {
      committed.push(value);
      await request;
    },
    clock,
  );
  controller.queue("A");
  clock.advance(5000);
  assert.equal(controller.snapshot?.phase, "committing");
  assert.equal(controller.cancel(), false);
  assert.equal(controller.queue("A"), false);
  await settle();
  assert.equal(committed.length, 1);
  assert.equal(committed[0].operation, "A");
  finish();
  await settle();
  assert.equal(controller.snapshot, null);
  assert.equal(controller.queue("B"), true);
});

test("disposing on logout or unmount discards waiting and deadline-microtask work", async () => {
  for (const elapsed of [1000, 5000]) {
    const clock = new FakeClock();
    let calls = 0;
    const controller = new PendingDeletionController(
      () => {},
      async () => {
        calls++;
      },
      clock,
    );
    controller.queue("A");
    clock.advance(elapsed);
    controller.dispose();
    clock.advance(10000);
    await settle();
    assert.equal(calls, 0);
    assert.equal(controller.queue("B"), false);
    assert.equal(clock.timers.size, 0);
  }
});

test("rejected requests release the queue without pretending that deletion was undone", async () => {
  const clock = new FakeClock();
  const phases: (string | null)[] = [];
  const controller = new PendingDeletionController<string>(
    (value) => phases.push(value?.phase || null),
    async () => {
      throw new Error("Application deleted; screenshot cleanup pending");
    },
    clock,
  );
  controller.queue("A");
  clock.advance(5000);
  await settle();
  assert.equal(controller.snapshot, null);
  assert.equal(phases.includes("committing"), true);
  assert.equal(phases.at(-1), null);
});

test("finishing a deletion cannot clear a different or reselected editor", () => {
  const operation = { id: "A", selectionGeneration: 7 };
  assert.equal(deletionMatchesSelection(operation, "A", 7), true);
  assert.equal(deletionMatchesSelection(operation, "B", 8), false);
  assert.equal(deletionMatchesSelection(operation, "A", 9), false);
  assert.equal(deletionMatchesSelection(operation, null, 8), false);
});

test("an old toast cannot leave the next operation paused while hidden state remains effective", async () => {
  const clock = new FakeClock();
  const calls: string[] = [];
  const controller = new PendingDeletionController<string>(
    () => {},
    async ({ operation }) => {
      calls.push(operation);
    },
    clock,
  );
  controller.queue("A");
  controller.pause("focus", true);
  controller.pause("hidden", true);
  controller.cancel();
  controller.queue("B");
  clock.advance(10000);
  assert.deepEqual(calls, []);
  controller.pause("hidden", false);
  clock.advance(5000);
  await settle();
  assert.deepEqual(calls, ["B"]);
});
