import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eccentricAnomaly,
  meanMotion,
  orbitalElements,
  ORBIT_BANDS,
} from "../src/lib/orbital-sky";

test("inner belts orbit faster according to Kepler's third law", () => {
  assert.ok(meanMotion(1) > meanMotion(8));
  assert.ok(Math.abs(meanMotion(1) / meanMotion(4) - 8) < 1e-10);
  assert.ok(meanMotion(1) * 5 > meanMotion(8) * 5);
});

test("four Newton iterations resolve periapsis and wrapped time", () => {
  for (const e of [0, 0.05, 0.26, 0.5]) {
    for (const m of [-7, -0.05, 0, 0.001, 0.1, Math.PI, 6.2, 80]) {
      const E = eccentricAnomaly(m, e);
      const wrapped = ((m % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      assert.ok(Math.abs(E - e * Math.sin(E) - wrapped) < 1e-7);
    }
  }
});

test("the deterministic static buffer preserves five separated bands and one primary", () => {
  const values = orbitalElements(90000);
  assert.equal(values[7], -1);
  assert.deepEqual(orbitalElements(3), values.slice(0, 24));
  const totals = [0, 0, 0, 0, 0];
  for (let i = 8; i < values.length; i += 8) {
    const [a, e, inc, , , , n, seed] = values.slice(i, i + 8);
    const band = ORBIT_BANDS.findIndex((b) => a >= b[0] && a <= b[1]);
    assert.ok(band >= 0, "No bodies generated in belt gaps");
    assert.ok(e >= 0 && e <= ORBIT_BANDS[band][2]);
    assert.ok(Math.abs(inc) <= ORBIT_BANDS[band][3]);
    assert.ok(Math.abs(n - meanMotion(a)) < 1e-7);
    assert.ok(seed > 0 && seed <= 1);
    totals[band]++;
  }
  totals.forEach((total, i) =>
    assert.ok(Math.abs(total / 89999 - ORBIT_BANDS[i][4]) < 0.01),
  );
});
