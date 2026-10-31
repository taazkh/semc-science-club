import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { readBody, fail } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/repository";
import {
  TEST_COOKIE,
  TEST_ACCESS_SECONDS,
  accessConfigured,
  signAccess,
  verifyAccessCode,
} from "@/lib/access-token";
import { DomainError } from "@/lib/domain";
export async function POST(req: NextRequest) {
  try {
    const input = z
      .object({
        action: z.enum(["enter", "leave"]),
        code: z.string().max(128).optional(),
      })
      .parse(await readBody(req));
    const jar = await cookies();
    if (input.action === "leave") {
      jar.delete(TEST_COOKIE);
      return NextResponse.json({ ok: true });
    }
    if (!accessConfigured())
      throw new DomainError(
        "Test access is temporarily unavailable. Please contact the organiser.",
        503,
      );
    await rateLimit(
      "test-access:" +
        (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"),
      10,
      900,
    );
    if (!verifyAccessCode(input.code || ""))
      throw new DomainError(
        "That access code is incorrect. Please check the code you were given.",
        403,
      );
    jar.set(TEST_COOKIE, signAccess(Date.now() + TEST_ACCESS_SECONDS * 1000), {
      httpOnly: true,
      secure: process.env.APP_URL?.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: TEST_ACCESS_SECONDS,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
