import { requireTestAccess } from "@/lib/server/test-access";
import { NextRequest, NextResponse } from "next/server";
import { retrieveApplication } from "@/lib/server/repository";
import { readBody, throttle, fail } from "@/lib/server/http";
import { z } from "zod";
export async function POST(req: NextRequest) {
  try {
    await requireTestAccess();
    const b = z
      .object({ reference: z.string().max(80), token: z.string().max(128) })
      .parse(await readBody(req));
    await throttle(req, "status", 120);
    return NextResponse.json({
      application: await retrieveApplication(b.reference, b.token),
    });
  } catch (e) {
    return fail(e);
  }
}
