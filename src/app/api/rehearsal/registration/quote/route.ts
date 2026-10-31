import { NextRequest, NextResponse } from "next/server";
import { quoteApplication } from "@/lib/server/repository";
import { requireRehearsalAccess } from "@/lib/server/rehearsal";
import { readBody, throttle, fail } from "@/lib/server/http";
export async function POST(req: NextRequest) {
  try {
    await requireRehearsalAccess();
    await throttle(req, "quote", 60);
    return NextResponse.json(
      await quoteApplication(await readBody(req), true),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
