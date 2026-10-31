export const TAU = Math.PI * 2;
export const BANDS = [
  [0.9, 1.35, 0.05, 0.03, 0.16],
  [1.7, 2.35, 0.09, 0.055, 0.24],
  [2.9, 3.9, 0.14, 0.09, 0.3],
  [4.6, 5.4, 0.1, 0.32, 0.14],
  [6.3, 8.6, 0.26, 0.24, 0.16],
] as const;
export function seededRandom(seed = 8317) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function meanMotion(a: number) {
  return 0.42 / a ** 1.5;
}
export function eccentricAnomaly(mean: number, e: number) {
  const m = ((mean % TAU) + TAU) % TAU;
  let E = m + e * Math.sin(m);
  for (let k = 0; k < 4; k++)
    E -= (E - e * Math.sin(E) - m) / Math.max(0.15, 1 - e * Math.cos(E));
  return E;
}
export function scrollSpeed(progress: number) {
  return 0.85 + Math.min(1, Math.max(0, progress)) * 5.5;
}
export function decayVelocity(v: number, dt: number) {
  const next = v * Math.pow(0.0016, dt);
  return Math.abs(next) < 0.0001 ? 0 : next;
}
export function makeParticles(count: number) {
  const random = seededRandom();
  const data = new Float32Array(count * 8);
  data[7] = -1;
  for (let p = 1; p < count; p++) {
    const pick = random();
    let cumulative = 0;
    const band =
      BANDS.find((b) => {
        cumulative += b[4];
        return pick < cumulative;
      }) ?? BANDS[4];
    const j = p * 8;
    data[j] = band[0] + random() * (band[1] - band[0]);
    data[j + 1] = Math.abs(random() + random() - 1) * band[2];
    data[j + 2] = (random() + random() - 1) * band[3];
    data[j + 3] = random() * TAU;
    data[j + 4] = random() * TAU;
    data[j + 5] = random() * TAU;
    data[j + 6] = random() < 0.015 ? 1 : 0;
    data[j + 7] = random();
  }
  return data;
}
