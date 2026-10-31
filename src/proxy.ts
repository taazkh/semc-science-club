import { NextRequest, NextResponse } from "next/server";
import {
  TEST_COOKIE,
  testAccessRequired,
  accessConfigured,
  validAccess,
} from "./lib/access-token";
export function proxy(req: NextRequest) {
  if (!testAccessRequired()) return NextResponse.next();
  const p = req.nextUrl.pathname;
  const exact = [
    "/access",
    "/api/test-access",
    "/api/auth",
    "/api/payment/proof",
    "/auth/confirm",
    "/robots.txt",
    "/favicon.ico",
  ];
  if (
    exact.includes(p) ||
    ["/admin", "/api/admin", "/_next", "/brand", "/fonts", "/assets"].some(
      (prefix) => p === prefix || p.startsWith(prefix + "/"),
    )
  )
    return NextResponse.next();
  if (accessConfigured() && validAccess(req.cookies.get(TEST_COOKIE)?.value))
    return NextResponse.next();
  if (p.startsWith("/api/"))
    return NextResponse.json(
      {
        error: "Enter the shared access code to continue.",
        code: "TEST_ACCESS_REQUIRED",
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const target = new URL("/access", req.url);
  // Never forward query strings that could contain private details.
  target.searchParams.set("next", p);
  return NextResponse.redirect(target);
}
export const config = { matcher: "/((?!_next/static|_next/image).*)" };
