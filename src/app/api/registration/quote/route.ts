import { requireTestAccess } from "@/lib/server/test-access";
import { NextRequest, NextResponse } from "next/server";
import { quoteApplication } from "@/lib/server/repository";
import { fail, readBody, throttle } from "@/lib/server/http";
export async function POST(req: NextRequest) {
  try {
    await requireTestAccess();
    const body = await readBody(req);
    await throttle(req, "quote", 60);
    return NextResponse.json(await quoteApplication(body), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
