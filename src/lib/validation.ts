import { z } from "zod";
export const personSchema = z.object({
  name: z.string().trim().min(2).max(100),
  school: z.string().trim().min(2).max(180),
  class: z.number().int().min(3).max(12),
  age: z.number().int().min(5).max(30).optional(),
});
export const registrationSchema = z.object({
  contact: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.email().max(180),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{8,20}$/),
  }),
  entries: z
    .array(
      z.object({
        segmentId: z.string().max(80),
        teamName: z.string().trim().max(100).optional(),
        participants: z.array(personSchema).min(1).max(12),
      }),
    )
    .min(1)
    .max(18),
  idempotencyKey: z.uuid(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  consent: z.literal(true),
  expectedTotal: z.number().int().nonnegative().optional(),
  website: z.string().max(0).optional(),
});
export const paymentSchema = z.object({
  transactionId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,30}$/),
  sender: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{8,20}$/),
  amount: z.number().int().positive().max(1000000),
  paidAt: z.iso.datetime(),
  timeSource: z.literal("submission").optional(),
  proofId: z.uuid().optional(),
});
export const contentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,100}$/),
  type: z.enum(["member", "post", "sponsor"]),
  title: z.string().trim().min(2).max(180),
  subtitle: z.string().max(250),
  body: z.string().max(20000),
  image: z
    .string()
    .max(1000)
    .refine((x) => !x || /^https:\/\//.test(x) || /^\/(?!\/)/.test(x)),
  url: z
    .string()
    .max(1000)
    .refine((x) => !x || /^https:\/\//.test(x)),
  group: z.string().max(80),
  published: z.boolean(),
  position: z.number().int().min(0).max(10000).optional(),
});
export const festivalSchema = z.object({
  title: z.string().min(2).max(120),
  month: z.string().min(2).max(80),
  dates: z.string().max(120),
  venue: z.string().min(2).max(200),
  registrationOpen: z.boolean(),
  bkashNumber: z.string().max(25),
  bkashInstruction: z.string().max(2000),
  contactEmail: z.union([z.email(), z.literal("")]),
  contactPhone: z.string().max(30),
  refundPolicy: z.string().max(5000),
});
export const segmentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  name: z.string().min(2).max(100),
  category: z.string().min(2).max(80),
  description: z.string().max(2000),
  kind: z.enum(["individual", "team", "exhibition"]),
  approved: z.boolean(),
  fee: z.number().int().min(0).max(100000).nullable(),
  minTeam: z.number().int().min(2).max(12).nullable(),
  maxTeam: z.number().int().min(2).max(12).nullable(),
  classes: z.array(z.number().int().min(3).max(12)),
  rules: z.string().max(10000),
  active: z.boolean().default(true),
  rulesStatus: z.enum(["draft", "approved"]).default("draft"),
  minAge: z.number().int().min(5).max(30).nullable().optional(),
  sources: z.array(z.url().startsWith("https://")).max(10).optional(),
  position: z.number().int().min(0).max(10000).optional(),
});
