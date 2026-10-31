import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import {
  adminData,
  getAudit,
  reviewApplication,
  saveAdminDocument,
  registrationOptions,
  deleteAdminRecord,
} from "@/lib/server/repository";
import { readBody, fail } from "@/lib/server/http";
import {
  contentSchema,
  festivalSchema,
  segmentSchema,
  registrationSchema,
  paymentSchema,
} from "@/lib/validation";
import { priceEntries, festivalReady, DomainError } from "@/lib/domain";
import { z } from "zod";
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const id = req.nextUrl.searchParams.get("audit");
    if (id) {
      await requireAdmin(["owner", "organiser"]);
      return NextResponse.json({ audit: await getAudit(z.uuid().parse(id)) });
    }
    return NextResponse.json(await adminData(admin));
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const b = await readBody(req);
    if (b.kind === "delete") {
      const target = z
        .enum(["application", "content", "segment"])
        .parse(b.target);
      await requireAdmin(
        target === "application"
          ? ["owner", "organiser"]
          : target === "content"
            ? ["owner", "editor"]
            : ["owner"],
      );
      const id =
        target === "application"
          ? z.uuid().parse(b.id)
          : z
              .string()
              .min(1)
              .max(120)
              .regex(/^[a-z0-9-]+$/)
              .parse(b.id);
      await deleteAdminRecord(admin, target, id);
      return NextResponse.json({ ok: true });
    }
    if (b.kind === "review") {
      await requireAdmin(["owner", "organiser"]);
      const id = z.uuid().parse(b.id);
      const action = z
        .enum([
          "verify",
          "reject-payment",
          "approve",
          "reject",
          "email-sent",
          "correct",
          "correct-payment",
          "reconcile",
        ])
        .parse(b.action);
      const payload = z
        .object({
          reason: z.string().max(1000).optional(),
          correction: z.unknown().optional(),
          payment: paymentSchema.optional(),
          effectiveAmount: z.number().int().nonnegative().optional(),
        })
        .parse(b.payload || {}) as Record<string, unknown>;
      if (action === "correct-payment")
        payload.payment = paymentSchema.parse(payload.payment);
      if (action === "correct") {
        const c = z
          .object({
            contact: registrationSchema.shape.contact,
            entries: registrationSchema.shape.entries,
          })
          .parse(payload.correction);
        payload.correction = c;
      }
      return NextResponse.json({
        application: await reviewApplication(admin, id, action, payload),
      });
    }
    if (b.kind === "content") {
      await requireAdmin(["owner", "editor"]);
      const data = contentSchema.parse(b.data);
      if (data.type === "member") data.image = "";
      if (data.type === "post")
        throw new DomainError(
          "Updates have been retired. Manage members or supporters instead.",
          410,
        );
      await saveAdminDocument(
        admin,
        "content",
        data.id,
        data,
        b.remove === true,
      );
    } else if (b.kind === "festival") {
      await requireAdmin(["owner"]);
      const data = festivalSchema.parse(b.data);
      if (data.registrationOpen && !festivalReady(data))
        throw new DomainError(
          "Complete exact dates, bKash instructions, official email and refund arrangements before opening registration.",
        );
      await saveAdminDocument(admin, "festival", "2026", data);
    } else if (b.kind === "segment") {
      await requireAdmin(["owner"]);
      const data = segmentSchema.parse(b.data);
      await saveAdminDocument(admin, "segment", data.id, data);
    } else throw new DomainError("Unknown administrator action.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
