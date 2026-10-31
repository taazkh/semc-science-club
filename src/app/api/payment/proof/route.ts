import { requireTestAccess } from "@/lib/server/test-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { retrieveApplication } from "@/lib/server/repository";
import {
  finalizeProof,
  prepareProof,
  proofImage,
  requireReadyProof,
} from "@/lib/server/payment-proofs";
import { requireAdmin } from "@/lib/server/auth";
import { fail, readBody, throttle } from "@/lib/server/http";
const schema = z.object({
  action: z.enum(["prepare", "finalize", "view", "admin-view"]),
  reference: z.string().max(80).optional(),
  token: z.string().max(128).optional(),
  proofId: z.uuid().optional(),
  applicationId: z.uuid().optional(),
  mime: z.string().optional(),
  size: z.number().optional(),
});
export async function POST(req: NextRequest) {
  try {
    const b = schema.parse(await readBody(req));
    await throttle(req, "proof", 60);
    let result;
    if (b.action === "admin-view") {
      await requireAdmin(["owner", "organiser"]);
      const proof = await requireReadyProof(b.applicationId || "", b.proofId);
      result = await proofImage(proof);
    } else {
      await requireTestAccess();
      const a = await retrieveApplication(b.reference || "", b.token || "");
      if (b.action === "prepare")
        result = await prepareProof(a, b.mime || "", b.size || 0);
      else if (b.action === "finalize")
        result = { proof: await finalizeProof(a, b.proofId || "") };
      else result = await proofImage(await requireReadyProof(a.id, b.proofId));
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
