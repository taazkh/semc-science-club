import assert from "node:assert/strict";
import test from "node:test";
import { claimReveal } from "../src/lib/redesign/reveal";

function harness() {
  const keys = ["document", "innerHeight", "IntersectionObserver"] as const;
  const original = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  const dataset: Record<string, string> = { motion: "off" };
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: { documentElement: { dataset } } },
    innerHeight: { configurable: true, value: 800 },
    IntersectionObserver: { configurable: true, value: class {} },
  });
  const node = (reveal: string, top = 1000, supported = true) => ({
    dataset: { reveal },
    ...(supported ? { animate() {} } : {}),
    getBoundingClientRect: () => ({ top }),
  }) as unknown as Element & { dataset: DOMStringMap };
  return {
    dataset,
    node,
    restore() {
      keys.forEach((key, index) => {
        const descriptor = original[index];
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      });
    },
  };
}

test("late hydration recovers unseen text after the loading watchdog", () => {
  const env = harness();
  try {
    const text = env.node("bypass");
    assert.equal(claimReveal(text, false), true);
    assert.equal(text.dataset.reveal, "pending");
    assert.equal(text.dataset.revealOwned, "true");
    assert.equal(env.dataset.motion, "enhanced");
    assert.equal(env.dataset.motionReady, "true");
  } finally { env.restore(); }
});

test("a newly selected visible diagram still animates after a loading fallback", () => {
  const env = harness();
  try {
    const diagram = env.node("pending", 200);
    assert.equal(claimReveal(diagram, false), true);
    assert.equal(diagram.dataset.reveal, "pending");
    assert.equal(env.dataset.motion, "enhanced");
  } finally { env.restore(); }
});

test("late hydration leaves already exposed or completed content readable", () => {
  const env = harness();
  try {
    for (const [state, top] of [["bypass", 200], ["bypass", -200], ["complete", 1000]] as const) {
      const node = env.node(state, top);
      assert.equal(claimReveal(node, false), false);
      assert.equal(node.dataset.reveal, "complete");
    }
  } finally { env.restore(); }
});

test("a loading screen preserves the first entrance after the watchdog expires", () => {
  const env = harness();
  try {
    env.dataset.initialLoading = "true";
    const heading = env.node("bypass", 200);
    assert.equal(claimReveal(heading, false), true);
    assert.equal(heading.dataset.reveal, "pending");
  } finally { env.restore(); }
});

test("reduced motion and unsupported animation keep the readable fallback", () => {
  const env = harness();
  try {
    for (const [reduced, supported] of [[true, true], [false, false]]) {
      const node = env.node("bypass", 1000, supported);
      assert.equal(claimReveal(node, reduced), false);
      assert.equal(node.dataset.reveal, "complete");
      assert.equal(env.dataset.motion, "off");
    }
  } finally { env.restore(); }
});
