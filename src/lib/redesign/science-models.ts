export type Point = { x: number; y: number };
export function circumcircle(a: Point, b: Point, c: Point) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-8) return null;
  const aa = a.x * a.x + a.y * a.y,
    bb = b.x * b.x + b.y * b.y,
    cc = c.x * c.x + c.y * c.y;
  const x = (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d;
  const y = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d;
  return { x, y, r: Math.hypot(x - a.x, y - a.y) };
}
export const pendulumPeriod = (length: number) =>
  2 * Math.PI * Math.sqrt(length / 9.81);
export function lensImage(distance: number, focal = 70, height = 65) {
  const v = (focal * distance) / (distance - focal);
  return { v, height: (-height * v) / distance };
}
export function linePosition(values: number[]) {
  const sum = values.reduce((a, b) => a + b, 0);
  return sum ? values.reduce((a, b, i) => a + b * i, 0) / sum : null;
}
export function drive(left: number, right: number, track = 0.32) {
  const speed = (left + right) / 2,
    omega = (right - left) / track;
  return { speed, omega, radius: omega ? speed / omega : Infinity };
}
export const graphEdges = [
  [0, 1, 2],
  [0, 2, 5],
  [1, 3, 3],
  [2, 3, 1],
  [2, 4, 2],
  [3, 5, 4],
  [4, 5, 1],
] as const;
export function shortestPath() {
  const distance = [0, Infinity, Infinity, Infinity, Infinity, Infinity],
    parent = [-1, -1, -1, -1, -1, -1],
    order: number[] = [];
  while (order.length < 6) {
    const u = distance.reduce(
      (best, d, i) =>
        !order.includes(i) && (best < 0 || d < distance[best]) ? i : best,
      -1,
    );
    order.push(u);
    for (const [a, b, w] of graphEdges) {
      const v = a === u ? b : b === u ? a : -1;
      if (v >= 0 && distance[u] + w < distance[v]) {
        distance[v] = distance[u] + w;
        parent[v] = u;
      }
    }
  }
  const path: number[] = [];
  for (let u = 5; u >= 0; u = parent[u]) path.unshift(u);
  return { distance, parent, order, path };
}
export function frontFaceTurn(values: number[], turns: number) {
  let face = [...values];
  for (let n = 0; n < ((turns % 4) + 4) % 4; n++)
    face = [6, 3, 0, 7, 4, 1, 8, 5, 2].map((i) => face[i]);
  return face;
}
export function triangleTruss(load: number, span = 4, height = 1.7) {
  return {
    reaction: load / 2,
    tie: (load * span) / (4 * height),
    strut: (load * Math.hypot(span / 2, height)) / (2 * height),
  };
}
export function rayWall(origin: Point, angle: number) {
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  let length = (560 - origin.x) / dx;
  if (dy > 0) length = Math.min(length, (320 - origin.y) / dy);
  if (dy < 0) length = Math.min(length, (40 - origin.y) / dy);
  const wall = (300 - origin.x) / dx,
    y = origin.y + wall * dy;
  if (wall > 0 && y >= 100 && y <= 260) length = Math.min(length, wall);
  return { x: origin.x + dx * length, y: origin.y + dy * length };
}
