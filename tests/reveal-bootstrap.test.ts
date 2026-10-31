import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { revealBootstrap } from "../src/lib/redesign/reveal-bootstrap";

function boot({ reduced = false, supported = true, ready = false } = {}) {
  const dataset: Record<string, string> = ready ? { motionReady: "true" } : {};
  const unowned = { dataset: { reveal: "pending" } };
  const events: string[] = [];
  let timeout: (() => void) | undefined;
  runInNewContext(revealBootstrap, {
    document: {
      documentElement: { dataset },
      querySelectorAll: () => [unowned],
    },
    window: {
      ...(supported ? { IntersectionObserver: {} } : {}),
      dispatchEvent: (e: { type: string }) => events.push(e.type),
    },
    Element: { prototype: supported ? { animate() {} } : {} },
    matchMedia: () => ({ matches: reduced }),
    setTimeout: (fn: () => void) => {
      timeout = fn;
    },
    Event: class {
      constructor(public type: string) {}
    },
  });
  return { dataset, unowned, events, expire: () => timeout?.() };
}
test("reduced-motion and unsupported visits never enter a hidden reveal mode", () => {
  for (const options of [{ reduced: true }, { supported: false }]) {
    const state = boot(options);
    state.expire();
    assert.notEqual(state.dataset.motion, "enhanced");
  }
});
test("enhancement starts before hydration and fails open when the controller never arrives", () => {
  const state = boot();
  assert.equal(state.dataset.motion, "enhanced");
  state.expire();
  assert.equal(state.dataset.motion, "off");
  assert.deepEqual(state.events, ["semc-motion-bypass"]);
  assert.equal(state.unowned.dataset.reveal, "bypass");
});
test("a registered controller preserves below-fold pending states but abandoned islands bypass", () => {
  const state = boot({ ready: true });
  state.expire();
  assert.equal(state.dataset.motion, "enhanced");
  assert.equal(state.unowned.dataset.reveal, "bypass");
  assert.equal(state.events.length, 0);
});
