import { requireTestAccess } from "@/lib/server/test-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { retrieveApplication } from "@/lib/server/repository";
import { localUpload, proofLimit } from "@/lib/server/payment-proofs";
import { isDemo, demoAllowed } from "@/lib/server/config";
import { DomainError } from "@/lib/domain";
import { fail, sameOrigin, throttle } from "@/lib/server/http";
export async function POST(req: NextRequest) {
  try {
    await requireTestAccess();
    sameOrigin(req);
    if (!isDemo() || !demoAllowed())
      throw new DomainError("Local upload is unavailable.", 404);
    await throttle(req, "local-proof", 30);
    const reference = req.headers.get("x-registration-reference") || "";
    const token = req.headers.get("x-retrieval-key") || "";
    const id = z.uuid().parse(req.headers.get("x-proof-id"));
    const a = await retrieveApplication(reference, token);
    const reader = req.body?.getReader();
    if (!reader) throw new DomainError("Choose an image.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > proofLimit) {
        await reader.cancel();
        throw new DomainError("Maximum image size is 5 MB.", 413);
      }
      chunks.push(chunk.value);
    }
    await localUpload(a, id, Buffer.concat(chunks));
    return NextResponse.json({ uploaded: true });
  } catch (e) {
    return fail(e);
  }
}
