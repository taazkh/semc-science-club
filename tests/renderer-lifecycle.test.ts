import assert from "node:assert/strict";
import test from "node:test";
import { createRenderer } from "../src/lib/redesign/renderer";

type Listener = (event: Record<string, unknown>) => void;

class Target {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly listenerOptions = new Map<string, unknown>();

  addEventListener(type: string, listener: Listener, options?: unknown) {
    const group = this.listeners.get(type) ?? new Set<Listener>();
    group.add(listener);
    this.listeners.set(type, group);
    this.listenerOptions.set(type, options);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  send(type: string, properties: Record<string, unknown> = {}) {
    let prevented = false;
    const event = {
      target: this,
      preventDefault() {
        prevented = true;
      },
      ...properties,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return prevented;
  }

  get listenerCount() {
    return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }
}

function harness(options: { webgl?: boolean; shaderCompiles?: boolean } = {}) {
  const uniforms = new Map<string, number>();
  const resources = new Set<object>();
  const removed = new Set<object>();
  const allocate = () => {
    const value = {};
    resources.add(value);
    return value;
  };
  const remove = (value: object) => {
    assert(!removed.has(value), "A GPU resource must be deleted only once");
    removed.add(value);
  };
  const noop = () => {};
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    BLEND: 8,
    SRC_ALPHA: 9,
    ONE: 10,
    DEPTH_TEST: 11,
    COLOR_BUFFER_BIT: 12,
    POINTS: 13,
    ONE_MINUS_SRC_ALPHA: 14,
    createProgram: allocate,
    createShader: allocate,
    createBuffer: allocate,
    createVertexArray: allocate,
    deleteProgram: remove,
    deleteShader: remove,
    deleteBuffer: remove,
    deleteVertexArray: remove,
    shaderSource: noop,
    compileShader: noop,
    getShaderParameter: () => options.shaderCompiles !== false,
    getShaderInfoLog: () => "Controlled compile failure",
    attachShader: noop,
    linkProgram: noop,
    getProgramParameter: () => true,
    useProgram: noop,
    bindVertexArray: noop,
    bindBuffer: noop,
    bufferData: noop,
    enableVertexAttribArray: noop,
    vertexAttribPointer: noop,
    enable: noop,
    blendFunc: noop,
    blendFuncSeparate: noop,
    disable: noop,
    getUniformLocation: (_program: unknown, name: string) => ({ name }),
    uniform3fv: noop,
    clearColor: noop,
    viewport: noop,
    clear: noop,
    uniform1f: (location: { name: string }, value: number) =>
      uniforms.set(location.name, value),
    uniform2f: noop,
    uniform3f: noop,
    drawArrays: noop,
    getExtension: () => ({ loseContext: noop }),
  };
  const canvas = Object.assign(new Target(), {
    width: 0,
    height: 0,
    getContext: () => (options.webgl === false ? null : gl),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }),
  });
  const interaction = Object.assign(new Target(), {
    setPointerCapture: noop,
    getBoundingClientRect: () => ({
      left: 20,
      top: 320,
      width: 350,
      height: 350,
    }),
  });
  const page = Object.assign(new Target(), {
    hidden: false,
    body: Object.assign(new Target(), { scrollHeight: 2844 }),
    documentElement: { scrollHeight: 2844 },
  });
  const windowTarget = Object.assign(new Target(), { scrollY: 0 }) as Target & {
    scrollY: number;
    __orbitalStudy?: { active: number; current: unknown };
  };
  const observers: Observer[] = [];
  class Observer {
    targets = new Set<unknown>();
    disconnected = false;
    constructor(readonly callback?: () => void) {
      observers.push(this);
    }
    observe(target: unknown) {
      this.targets.add(target);
    }
    disconnect() {
      this.disconnected = true;
      this.targets.clear();
    }
  }
  const intersections: {
    observer: Observer;
    callback: (entries: { isIntersecting: boolean }[]) => void;
  }[] = [];
  class Intersection extends Observer {
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
      super();
      intersections.push({ observer: this, callback });
    }
  }
  let clock = 1000;
  let nextFrame = 1;
  const frames = new Map<number, FrameRequestCallback>();
  const globals: Record<string, unknown> = {
    window: windowTarget,
    document: page,
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 1,
    ResizeObserver: Observer,
    IntersectionObserver: Intersection,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  const originals = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  let failures = 0;
  const renderers: NonNullable<ReturnType<typeof createRenderer>>[] = [];
  function create() {
    const renderer = createRenderer(
      canvas as unknown as HTMLCanvasElement,
      [0.6, 0.7, 0.9],
      () => failures++,
    );
    if (renderer) renderers.push(renderer);
    return renderer;
  }
  const disposed = new Set<(typeof renderers)[number]>();
  function dispose(renderer: (typeof renderers)[number]) {
    renderer.dispose();
    disposed.add(renderer);
  }
  return {
    canvas,
    interaction,
    page,
    windowTarget,
    observers,
    resources,
    removed,
    uniforms,
    create,
    dispose,
    get failures() {
      return failures;
    },
    get pendingFrames() {
      return frames.size;
    },
    advance(milliseconds: number) {
      clock += milliseconds;
      const batch = [...frames.values()];
      frames.clear();
      for (const callback of batch) callback(clock);
    },
    intersect(visible: boolean, target: unknown = canvas) {
      for (const { observer, callback } of intersections)
        if (observer.targets.has(target))
          callback([{ isIntersecting: visible }]);
    },
    resize(target: unknown) {
      for (const observer of observers)
        if (observer.targets.has(target)) observer.callback?.();
    },
    restore() {
      try {
        for (const renderer of renderers)
          if (!disposed.has(renderer)) dispose(renderer);
      } finally {
        for (const [key, descriptor] of originals) {
          if (descriptor) Object.defineProperty(globalThis, key, descriptor);
          else Reflect.deleteProperty(globalThis, key);
        }
      }
    },
  };
}

test("unavailable or invalid WebGL invokes fallback without leaking resources", () => {
  for (const options of [{ webgl: false }, { shaderCompiles: false }]) {
    const env = harness(options);
    try {
      assert.equal(env.create(), null);
      assert.equal(env.failures, 1);
      assert.equal(env.pendingFrames, 0);
      assert.equal(
        env.interaction.listenerCount +
          env.page.listenerCount +
          env.canvas.listenerCount,
        0,
      );
      assert.deepEqual(env.removed, env.resources);
    } finally {
      env.restore();
    }
  }
});

test("scene ignores drag and keyboard input and reduced-motion suspension freezes its camera", () => {
  const env = harness();
  try {
    const renderer = env.create()!;
    renderer.setEnabled(true);
    env.advance(16);
    env.interaction.send("pointerdown", {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    env.interaction.send("pointermove", {
      pointerId: 1,
      clientX: 140,
      clientY: 115,
    });
    env.interaction.send("pointerup");
    env.advance(16);
    assert.equal(renderer.inspect().velocity, 0);
    assert.equal(renderer.inspect().yaw, 0.4 + 0.016 * 0.014);
    assert.equal(renderer.inspect().pitch, 1.06);
    assert.equal(renderer.inspect().distance, 15.4);
    assert.equal(env.interaction.listenerCount, 0);
    renderer.setEnabled(false);
    const paused = renderer.inspect();
    assert.equal(paused.velocity, 0);
    assert.equal(paused.running, false);
    assert.equal(env.pendingFrames, 0);
    env.advance(5000);
    assert.equal(renderer.inspect().time, paused.time);
    assert.equal(renderer.inspect().yaw, paused.yaw);
    assert.equal(renderer.inspect().pitch, paused.pitch);
    env.windowTarget.scrollY = 1000;
    env.windowTarget.send("scroll");
    env.advance(1000);
    assert.equal(renderer.inspect().distance, paused.distance);
    assert.equal(renderer.inspect().pitch, paused.pitch);
    assert.equal(renderer.inspect().frames, paused.frames);
    assert.equal(env.interaction.send("keydown", { key: "ArrowRight" }), false);
    const rotated = renderer.inspect();
    assert.equal(rotated.yaw, paused.yaw);
    assert.equal(rotated.time, paused.time);
    assert.equal(rotated.velocity, 0);
    assert.equal(rotated.frames, paused.frames);
    assert.equal(env.pendingFrames, 0);
  } finally {
    env.restore();
  }
});

test("hidden tabs suspend work and restoring them does not advance through the hidden interval", () => {
  const env = harness();
  try {
    const renderer = env.create()!;
    renderer.setEnabled(true);
    env.advance(16);
    env.advance(16);
    const before = renderer.inspect();
    env.page.hidden = true;
    env.page.send("visibilitychange");
    assert.equal(env.pendingFrames, 0);
    assert.equal(renderer.inspect().running, false);
    env.advance(60000);
    assert.equal(renderer.inspect().time, before.time);
    assert.equal(renderer.inspect().frames, before.frames);
    assert.equal(renderer.inspect().yaw, before.yaw);
    assert.equal(renderer.inspect().pitch, before.pitch);
    assert.equal(renderer.inspect().distance, before.distance);
    env.page.hidden = false;
    env.page.send("visibilitychange");
    assert.equal(env.pendingFrames, 1);
    env.advance(16);
    assert.equal(
      renderer.inspect().time,
      before.time,
      "The first restored frame resets its clock",
    );
    env.advance(16);
    const resumed = renderer.inspect();
    assert(resumed.time > before.time);
    assert(
      resumed.time - before.time < 0.05,
      "Only the visible frame interval advances time",
    );
  } finally {
    env.restore();
  }
});

test("an offscreen scene suspends its loop and resumes with a fresh frame clock", () => {
  const env = harness();
  try {
    const renderer = env.create()!;
    renderer.setEnabled(true);
    env.advance(16);
    env.advance(16);
    env.intersect(false);
    const stopped = renderer.inspect();
    assert.equal(env.pendingFrames, 0);
    env.advance(30000);
    assert.equal(renderer.inspect().frames, stopped.frames);
    assert.equal(renderer.inspect().time, stopped.time);
    assert.equal(renderer.inspect().yaw, stopped.yaw);
    assert.equal(renderer.inspect().pitch, stopped.pitch);
    assert.equal(renderer.inspect().distance, stopped.distance);
    env.intersect(true);
    env.advance(16);
    assert.equal(renderer.inspect().time, stopped.time);
    assert.equal(env.pendingFrames, 1);
  } finally {
    env.restore();
  }
});

test("passive page scroll drives the supplied speed, pitch, distance and slow yaw progression", () => {
  const env = harness();
  try {
    const renderer = env.create()!;
    assert.equal(renderer.inspect().speed, 0.85);
    assert.deepEqual(env.windowTarget.listenerOptions.get("scroll"), {
      passive: true,
    });
    renderer.setEnabled(true);
    env.advance(16);
    const before = renderer.inspect();
    env.windowTarget.scrollY = 1000;
    env.windowTarget.send("scroll");
    env.advance(16);
    const halfway = renderer.inspect();
    assert.equal(halfway.scrollProgress, 0.5);
    assert.equal(halfway.speed, 3.6);
    assert.equal(halfway.yaw, before.yaw + 0.016 * 0.014);
    assert(Math.abs(halfway.time - before.time - 0.016 * 3.6) < 1e-10);
    assert.equal(
      halfway.pitch,
      before.pitch + (0.785 - before.pitch) * (1 - Math.pow(0.982, 0.016 * 60)),
    );
    assert.equal(
      halfway.distance,
      before.distance +
        (13.7 - before.distance) * (1 - Math.pow(0.95, 0.016 * 60)),
    );
    assert.equal(env.uniforms.get("cameraDistance"), halfway.distance);
    assert.equal(env.uniforms.get("aspect"), 390 / 844);
    const portraitFit = env.uniforms.get("projectionFit") as number;
    assert.ok(portraitFit > 0 && portraitFit < 1);
  } finally {
    env.restore();
  }
});

test("scroll overshoot remains bounded and reversing restores the camera toward its rest pose", () => {
  const env = harness();
  try {
    const renderer = env.create()!;
    renderer.setEnabled(true);
    env.advance(16);
    env.windowTarget.scrollY = 100000;
    env.windowTarget.send("scroll");
    assert.equal(renderer.inspect().scrollProgress, 1);
    assert.equal(renderer.inspect().speed, 6.35);
    for (let step = 0; step < 240; step++) {
      env.advance(16);
      const current = renderer.inspect();
      assert(current.pitch >= 0.51 && current.pitch <= 1.06);
      assert(current.distance >= 12 && current.distance <= 15.4);
    }
    const bottom = renderer.inspect();
    assert(bottom.pitch < 0.52);
    assert(bottom.distance < 12.001);
    env.windowTarget.scrollY = -100;
    env.windowTarget.send("scroll");
    assert.equal(renderer.inspect().scrollProgress, 0);
    assert.equal(renderer.inspect().speed, 0.85);
    env.advance(16);
    const reversed = renderer.inspect();
    assert(reversed.pitch > bottom.pitch);
    assert(reversed.distance > bottom.distance);
    assert(reversed.yaw > bottom.yaw);
    assert(reversed.pitch <= 1.06 && reversed.distance <= 15.4);
  } finally {
    env.restore();
  }
});

test("document height is cached for scrolling and refreshed after content or viewport resize", () => {
  const env = harness();
  try {
    const renderer = env.create()!;
    env.windowTarget.scrollY = 1000;
    env.windowTarget.send("scroll");
    assert.equal(renderer.inspect().scrollProgress, 0.5);
    env.page.documentElement.scrollHeight = 4844;
    env.page.body.scrollHeight = 4844;
    env.windowTarget.send("scroll");
    assert.equal(renderer.inspect().scrollProgress, 0.5);
    env.resize(env.page.body);
    assert.equal(renderer.inspect().scrollProgress, 0.25);
    assert.equal(renderer.inspect().speed, 2.225);
    env.page.documentElement.scrollHeight = 844;
    env.page.body.scrollHeight = 844;
    env.windowTarget.send("resize");
    assert.equal(renderer.inspect().scrollProgress, 0);
    assert.equal(renderer.inspect().speed, 0.85);
    assert.equal(renderer.inspect().distance, 15.4);
    assert.equal(env.pendingFrames, 0);
  } finally {
    env.restore();
  }
});

test("scrolling the hero offscreen keeps its fixed viewport canvas running", () => {
  const env = harness();
  try {
    const renderer = env.create()!;
    renderer.setEnabled(true);
    env.advance(16);
    env.advance(16);
    const before = renderer.inspect();
    env.windowTarget.scrollY = 2000;
    env.windowTarget.send("scroll");
    env.intersect(false, env.interaction);
    env.advance(16);
    env.advance(16);
    assert.equal(renderer.inspect().running, true);
    assert(renderer.inspect().frames > before.frames);
    assert(renderer.inspect().time > before.time);
    assert.equal(env.pendingFrames, 1);
    assert.equal(
      env.observers.filter((observer) => observer.targets.has(env.canvas))
        .length,
      2,
      "Resize and visibility observers must both follow the canvas",
    );
    assert(
      env.observers.every((observer) => !observer.targets.has(env.interaction)),
    );
  } finally {
    env.restore();
  }
});

test("context loss stops animation and requests the fallback", () => {
  const env = harness();
  try {
    const renderer = env.create()!;
    renderer.setEnabled(true);
    env.advance(16);
    assert(env.canvas.send("webglcontextlost"));
    const stopped = renderer.inspect();
    assert.equal(env.failures, 1);
    assert.equal(env.pendingFrames, 0);
    assert.equal(stopped.running, false);
    renderer.setEnabled(true);
    env.advance(1000);
    assert.equal(renderer.inspect().frames, stopped.frames);
    assert.equal(renderer.inspect().time, stopped.time);
    assert.equal(env.pendingFrames, 0);
  } finally {
    env.restore();
  }
});

test("disposing multiple renderer instances releases all GPU resources, listeners and scheduled work", () => {
  const env = harness();
  try {
    const first = env.create()!;
    const second = env.create()!;
    first.setEnabled(true);
    second.setEnabled(true);
    assert.equal(first.inspect().active, 2);
    assert.equal(env.pendingFrames, 2);
    env.dispose(first);
    assert.equal(second.inspect().active, 1);
    assert.equal(env.pendingFrames, 1);
    env.dispose(second);
    assert.equal(env.windowTarget.__orbitalStudy?.active, 0);
    assert.equal(env.windowTarget.__orbitalStudy?.current, null);
    assert.equal(env.pendingFrames, 0);
    assert.deepEqual(env.removed, env.resources);
    assert(
      env.observers.every(
        (observer) => observer.disconnected && observer.targets.size === 0,
      ),
    );
    assert.equal(
      env.canvas.listenerCount +
        env.interaction.listenerCount +
        env.windowTarget.listenerCount +
        env.page.listenerCount,
      0,
    );
    const finalFrames = second.inspect().frames;
    env.advance(1000);
    env.page.send("visibilitychange");
    env.windowTarget.send("resize");
    env.interaction.send("keydown", { key: "ArrowRight" });
    assert.equal(second.inspect().frames, finalFrames);
    assert.equal(env.pendingFrames, 0);
  } finally {
    env.restore();
  }
});
