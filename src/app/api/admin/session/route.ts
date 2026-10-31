import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { adminSessionExpiry } from "@/lib/server/admin-session";
import { readBody, fail } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repository";
import { DomainError } from "@/lib/domain";
export async function GET() {
  try {
    const admin = await requireAdmin();
    return NextResponse.json(
      { expiresAt: admin.expiresAt, serverNow: Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    await readBody(req);
    await rateLimit("admin-activity:" + admin.id, 240, 600);
    const expiresAt = await adminSessionExpiry(admin.id, true);
    if (!expiresAt)
      throw new DomainError(
        "Signed out after five minutes of inactivity.",
        401,
        "ADMIN_SESSION_EXPIRED",
      );
    return NextResponse.json(
      { expiresAt, serverNow: Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
