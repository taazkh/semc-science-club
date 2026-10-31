import { requireTestAccess } from "@/lib/server/test-access";
import { NextRequest, NextResponse } from "next/server";
import { submitPayment } from "@/lib/server/repository";
import { readBody, throttle, fail } from "@/lib/server/http";
import { z } from "zod";
export async function POST(req: NextRequest) {
  try {
    await requireTestAccess();
    const b = z
      .object({
        reference: z.string().max(80),
        token: z.string().max(128),
        payment: z.unknown(),
      })
      .parse(await readBody(req));
    await throttle(req, "payment", 30);
    return NextResponse.json({
      application: await submitPayment(b.reference, b.token, b.payment),
    });
  } catch (e) {
    return fail(e);
  }
}
