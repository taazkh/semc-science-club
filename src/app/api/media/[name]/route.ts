import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { demoAllowed } from "@/lib/server/config";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!demoAllowed() || !/^[-a-f0-9]{36}\.(png|jpg|webp)$/.test(name))
    return new NextResponse(null, { status: 404 });
  try {
    const data = await readFile(
      path.join(process.cwd(), ".data", "media", name),
    );
    return new NextResponse(data, {
      headers: {
        "Content-Type": name.endsWith(".jpg")
          ? "image/jpeg"
          : name.endsWith(".png")
            ? "image/png"
            : "image/webp",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
