import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/server/auth";
import { sameOrigin, fail } from "@/lib/server/http";
import { isDemo, demoAllowed } from "@/lib/server/config";
import { service } from "@/lib/server/supabase";
import { DomainError } from "@/lib/domain";
import { saveDoc, audit } from "@/lib/server/demo-db";
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(["owner", "editor"]);
    sameOrigin(req);
    if (Number(req.headers.get("content-length") || 0) > 6 * 1024 * 1024)
      throw new DomainError("Image must be smaller than 5 MB.");
    const form = await req.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 5 * 1024 * 1024 ||
      file.size === 0
    )
      throw new DomainError("Select a PNG, JPEG or WebP under 5 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? "jpg"
        : bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP"
          ? "webp"
          : null;
    if (!ext)
      throw new DomainError("Only PNG, JPEG and WebP images are accepted.");
    const name = randomUUID() + "." + ext;
    let url: string;
    if (isDemo()) {
      if (!demoAllowed()) throw new DomainError("Demo unavailable.", 403);
      await mkdir(path.join(process.cwd(), ".data", "media"), {
        recursive: true,
      });
      await writeFile(path.join(process.cwd(), ".data", "media", name), bytes);
      url = "/api/media/" + name;
      saveDoc("media", name, { name, size: bytes.length, actor: admin.id });
      audit(admin.id, "upload-media", null, null, { name, size: bytes.length });
    } else {
      const s = service();
      const { error } = await s.storage
        .from("club-media")
        .upload(name, bytes, {
          contentType: ext === "jpg" ? "image/jpeg" : "image/" + ext,
          upsert: false,
        });
      if (error)
        throw new DomainError(
          "Upload failed. Check the Storage bucket configuration.",
        );
      url = s.storage.from("club-media").getPublicUrl(name).data.publicUrl;
      const record = await s
        .from("media")
        .insert({ id: name, url, uploaded_by: admin.id, size: bytes.length });
      if (record.error)
        throw new DomainError(
          "Image uploaded but its media record could not be saved. Ask the owner to reconcile Storage.",
          409,
        );
    }
    return NextResponse.json({ url });
  } catch (e) {
    return fail(e);
  }
}
