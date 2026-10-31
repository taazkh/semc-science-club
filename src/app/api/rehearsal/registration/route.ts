import { NextRequest, NextResponse } from "next/server";
import { createApplication } from "@/lib/server/repository";
import { requireRehearsalAccess } from "@/lib/server/rehearsal";
import { readBody, throttle, fail } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    await requireRehearsalAccess();
    await throttle(req, "create", 20);
    return NextResponse.json(
      { application: await createApplication(await readBody(req), true) },
      { status: 201 },
    );
  } catch (e) {
    return fail(e);
  }
}
