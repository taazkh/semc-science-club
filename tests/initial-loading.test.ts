import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { firstViewReady, initialLoadingBootstrap } from "../src/lib/redesign/initial-loading";

function boot(pathname: string) {
  const dataset: Record<string, string> = {};
  const events: string[] = [];
  let expire: (() => void) | undefined;
  let deadline = 0;
  runInNewContext(initialLoadingBootstrap, {
    document: { documentElement: { dataset } }, location: { pathname },
    window: { dispatchEvent: (event: { type: string }) => events.push(event.type) },
    setTimeout: (callback: () => void, ms: number) => { expire = callback; deadline = ms; },
    Event: class { constructor(public type: string) {} },
  });
  return { dataset, events, deadline, expire: () => expire?.() };
}

test("exhibition entry has a bounded loading screen; private and form routes stay immediate", () => {
  for (const path of ["/", "/stemfest", "/stemfest/math-olympiad"]) {
    const env = boot(path);
    assert.equal(env.dataset.initialLoading, "true");
    assert.equal(env.deadline, 12000);
    env.expire();
    assert.equal(env.dataset.initialLoading, undefined);
    assert.deepEqual(env.events, ["semc-initial-loading-complete"]);
  }
  for (const path of ["/admin", "/admin/login", "/register", "/payment", "/status", "/members"]) {
    const env = boot(path);
    assert.equal(env.dataset.initialLoading, undefined);
    assert.equal(env.deadline, 0);
  }
});

test("the deadline does not repeat an already completed loading handoff", () => {
  const env = boot("/");
  delete env.dataset.initialLoading;
  env.expire();
  assert.deepEqual(env.events, []);
});

test("readiness waits for the first view and renderer fallback, excluding below-fold content", () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalHeight = Object.getOwnPropertyDescriptor(globalThis, "innerHeight");
  const item = (attributes: Record<string, string>, top = 100) => ({
    getAttribute: (name: string) => attributes[name] ?? null,
    getBoundingClientRect: () => ({ top, bottom: top + 40, width: 300, height: 40 }),
  });
  const scene = { "data-scene-state": "pending" };
  const text = { "data-reveal-owned": "false" };
  const stroke = { "data-ready": "false" };
  let heading = false;
  Object.defineProperties(globalThis, {
    innerHeight: { configurable: true, value: 800 },
    document: { configurable: true, value: {
      querySelector: (selector: string) => selector === "main h1" ? heading : item(scene),
      querySelectorAll: (selector: string) => selector === "[data-reveal]"
        ? [item(text), item({}, 1200)] : [item(stroke)],
    } },
  });
  try {
    assert.equal(firstViewReady(), false);
    heading = true;
    assert.equal(firstViewReady(), false);
    scene["data-scene-state"] = "fallback";
    assert.equal(firstViewReady(), false);
    text["data-reveal-owned"] = "true";
    assert.equal(firstViewReady(), false);
    stroke["data-ready"] = "true";
    assert.equal(firstViewReady(), true);
    scene["data-scene-state"] = "ready";
    assert.equal(firstViewReady(), true);
  } finally {
    for (const [key, descriptor] of [["document", originalDocument], ["innerHeight", originalHeight]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
