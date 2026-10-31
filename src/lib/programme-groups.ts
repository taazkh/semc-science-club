import type { Segment } from "./types";

export const programmeCategories = [
  "Science & making",
  "Programming",
  "Olympiads",
  "Robotics",
  "Esports",
  "Fun activities",
] as const;

/** Keep new administrator-created categories visible after the established groups. */
export function groupSegments(segments: Segment[]) {
  const categories = [
    ...new Set<string>([
      ...programmeCategories,
      ...segments.map((segment) => segment.category),
    ]),
  ];
  return categories
    .map((category) => ({
      category,
      segments: segments
        .filter((segment) => segment.category === category)
        .sort((a, b) => (a.position ?? 10000) - (b.position ?? 10000)),
    }))
    .filter((group) => group.segments.length > 0);
}
