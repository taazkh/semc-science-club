import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "../domain";
import { rateLimit } from "./repository";
export function fail(e: unknown) {
  if (e instanceof ZodError)
    return NextResponse.json(
      {
        error: e.issues
          .map((x) => x.path.join(".") + ": " + x.message)
          .join("; "),
      },
      { status: 400 },
    );
  if (e instanceof DomainError)
    return NextResponse.json(
      { error: e.message, code: e.code },
      { status: e.status },
    );
  console.error(
    "Request failed:",
    e instanceof Error ? e.name : "Unknown error",
  );
  return NextResponse.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_URL || new URL(req.url).origin;
  if (!origin || origin !== new URL(expected).origin)
    throw new DomainError("This request must come from the website.", 403);
}
export async function readBody(req: NextRequest) {
  sameOrigin(req);
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new DomainError("Expected JSON.", 415);
  if (Number(req.headers.get("content-length") || 0) > 100000)
    throw new DomainError("Request is too large.", 413);
  const text = await req.text();
  if (text.length > 100000) throw new DomainError("Request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("Invalid request body.");
  }
}
export async function throttle(req: NextRequest, scope: string, limit = 30) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await rateLimit(scope + ":" + ip, limit);
}
