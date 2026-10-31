import { requireTestAccess } from "@/lib/server/test-access";
import { NextRequest, NextResponse } from "next/server";
import { createApplication } from "@/lib/server/repository";
import { readBody, throttle, fail } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    await requireTestAccess();
    const body = await readBody(req);
    await throttle(req, "create", 20);
    const application = await createApplication(body);
    return NextResponse.json({ application }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
