import test from "node:test";
import assert from "node:assert/strict";
import {
  circumcircle,
  pendulumPeriod,
  lensImage,
  linePosition,
  drive,
  shortestPath,
  frontFaceTurn,
  triangleTruss,
  rayWall,
} from "../src/lib/redesign/science-models";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} differs from ${b}`);
test("circumcentre remains equidistant as a vertex moves", () => {
  for (let x = 245; x <= 345; x += 5) {
    const points = [
        { x: 155, y: 265 },
        { x: 445, y: 265 },
        { x, y: 70 },
      ],
      circle = circumcircle(
        ...(points as [
          { x: number; y: number },
          { x: number; y: number },
          { x: number; y: number },
        ]),
      )!;
    points.forEach((p) =>
      near(Math.hypot(p.x - circle.x, p.y - circle.y), circle.r),
    );
  }
  assert.equal(
    circumcircle({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }),
    null,
  );
});
test("pendulum period squared grows linearly with length", () =>
  near(pendulumPeriod(1.2) ** 2 / pendulumPeriod(0.4) ** 2, 3));
test("lens rays intersect at the computed inverted image", () => {
  for (let u = 130; u <= 230; u += 5) {
    const image = lensImage(u);
    near(1 / u + 1 / image.v, 1 / 70);
    near(image.height, (-65 * image.v) / u);
    near(65 - (image.v * 65) / 70, image.height);
  }
});
test("sensor estimator and differential drive obey symmetry", () => {
  near(linePosition([1, 2, 3, 2, 1])!, 2);
  assert.equal(linePosition([0, 0, 0]), null);
  assert.equal(drive(1, 1).radius, Infinity);
  near(drive(0.5, 1.5).omega, -drive(1.5, 0.5).omega);
});
test("weighted search selects the minimum-cost route", () => {
  const r = shortestPath();
  assert.deepEqual(r.path, [0, 2, 4, 5]);
  assert.equal(r.distance[5], 8);
  assert.deepEqual(r.order, [0, 1, 2, 3, 4, 5]);
});
test("cube turn preserves centre and returns to identity after four turns", () => {
  const face = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  assert.deepEqual(frontFaceTurn(face, 1), [7, 4, 1, 8, 5, 2, 9, 6, 3]);
  assert.deepEqual(frontFaceTurn(face, 4), face);
  assert.deepEqual(frontFaceTurn(frontFaceTurn(face, 1), 3), face);
});
test("truss joints balance applied loads", () => {
  for (const p of [10, 55, 100]) {
    const m = triangleTruss(p),
      angle = Math.atan2(1.7, 2);
    near(m.reaction * 2, p);
    near(2 * m.strut * Math.sin(angle), p);
    near(m.strut * Math.cos(angle), m.tie);
  }
});
test("sight rays stop at a wall or the viewport boundary", () => {
  assert.deepEqual(rayWall({ x: 120, y: 175 }, 0), { x: 300, y: 175 });
  assert.deepEqual(rayWall({ x: 120, y: 90 }, 0), { x: 560, y: 90 });
  for (let y = 90; y <= 250; y += 10)
    for (let deg = -40; deg <= 40; deg += 5) {
      const hit = rayWall({ x: 120, y }, (deg * Math.PI) / 180);
      assert.ok(
        hit.y >= 40 - 1e-8 && hit.y <= 320 + 1e-8 && hit.x <= 560 + 1e-8,
      );
      if (hit.x > 300) {
        const wallY = y + (300 - 120) * Math.tan((deg * Math.PI) / 180);
        assert.ok(wallY < 100 || wallY > 260);
      }
    }
});
