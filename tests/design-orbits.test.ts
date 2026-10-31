import assert from "node:assert/strict";
import test from "node:test";
import {
  BANDS,
  TAU,
  makeParticles,
  eccentricAnomaly,
  meanMotion,
  decayVelocity,
  scrollSpeed,
} from "../src/lib/redesign/orbits";
test("orbital elements are deterministic, bounded and all five bands retain their weights", () => {
  const data = makeParticles(90000);
  assert.deepEqual(data, makeParticles(90000));
  assert.equal(data[7], -1);
  const counts = [0, 0, 0, 0, 0];
  for (let i = 8; i < data.length; i += 8) {
    const band = BANDS.findIndex((b) => data[i] >= b[0] && data[i] <= b[1]);
    assert.ok(band >= 0);
    counts[band]++;
    assert.ok(data[i + 1] <= BANDS[band][2]);
    assert.ok(Math.abs(data[i + 2]) <= BANDS[band][3]);
  }
  counts.forEach((count, i) =>
    assert.ok(Math.abs(count / 89999 - BANDS[i][4]) < 0.006),
  );
});
test("four Newton iterations solve all supported eccentricities to 1e-12 radians", () => {
  for (let e = 0; e <= 0.261; e += 0.013)
    for (let m = -TAU; m < TAU * 3; m += 0.031) {
      const E = eccentricAnomaly(m, e),
        wrapped = ((m % TAU) + TAU) % TAU;
      assert.ok(Math.abs(E - e * Math.sin(E) - wrapped) < 1e-12);
    }
  assert.ok(meanMotion(0.9) > meanMotion(1.7));
  assert.ok(meanMotion(1.7) > meanMotion(8.6));
});
test("inertia settles and scroll acceleration is bounded", () => {
  let v = 10;
  for (let i = 0; i < 180; i++) v = decayVelocity(v, 1 / 60);
  assert.equal(v, 0);
  assert.equal(scrollSpeed(0), 0.85);
  assert.equal(scrollSpeed(1), 6.35);
  assert.equal(scrollSpeed(3), 6.35);
  assert.equal(scrollSpeed(-1), 0.85);
});
