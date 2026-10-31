import type { Festival, Segment } from "./types";
import teacherContent from "./teacher-content.json";
export const programmeSegments = teacherContent.segments as Segment[];
export const proposedSegments = programmeSegments;
export const initialMembers = teacherContent.members;
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const initialFestival: Festival = {
  title: "SEMC STEMfest 2026",
  month: "November 2026",
  dates: "16 November 2026",
  venue: "SEMC campus, Tejgaon, Dhaka",
  registrationOpen: false,
  bkashNumber: "",
  bkashInstruction: "",
  contactEmail: "",
  contactPhone: "",
  refundPolicy: "",
};
export const demoSegments: Segment[] = [
  {
    ...proposedSegments[3],
    id: "demo-math",
    name: "Demo Math Challenge",
    approved: true,
    fee: 200,
    classes: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    rules:
      "Synthetic test event. Individual entry for classes 3–12. This is not an official festival rule.",
  },
  {
    ...proposedSegments[0],
    id: "demo-project",
    name: "Demo Project Team",
    kind: "team",
    approved: true,
    fee: 600,
    minTeam: 2,
    maxTeam: 4,
    classes: [6, 7, 8, 9, 10, 11, 12],
    rules:
      "Synthetic test event. Teams of 2–4, classes 6–12. This is not an official festival rule.",
  },
];
export const money = (n: number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(n);
