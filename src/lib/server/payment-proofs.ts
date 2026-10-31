import "server-only";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { isDemo } from "./config";
import { readDoc, saveDoc } from "./demo-db";
import { service } from "./supabase";
import { DomainError } from "../domain";
import type { Application, PaymentProof } from "../types";

export const proofLimit = 5 * 1024 * 1024;
const bucket = "payment-proofs";
const formats: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
};
const localPath = (name: string) =>
  path.join(process.cwd(), ".data", bucket, name);
async function save(proof: PaymentProof) {
  if (isDemo()) {
    saveDoc("proof", proof.id, proof);
    return;
  }
  const { error } = await service()
    .from("payment_proofs")
    .upsert({ id: proof.id, application_id: proof.applicationId, data: proof });
  if (error)
    throw new DomainError("Could not save the screenshot. Please retry.", 503);
}
export async function getProof(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id))
    throw new DomainError("Screenshot not found.", 404);
  if (isDemo()) return readDoc<PaymentProof>("proof", id);
  const { data, error } = await service()
    .from("payment_proofs")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new DomainError("Screenshot storage is unavailable.", 503);
  return (data?.data as PaymentProof) || null;
}
export async function requireReadyProof(applicationId: string, id?: string) {
  const proof = id ? await getProof(id) : null;
  if (
    !proof ||
    proof.applicationId !== applicationId ||
    proof.status !== "ready"
  )
    throw new DomainError(
      "Upload a valid payment screenshot before submitting.",
    );
  return proof;
}
function editable(a: Application) {
  if (a.payment || a.total === 0)
    throw new DomainError(
      "This application is not accepting payment screenshots.",
      409,
    );
}
export async function prepareProof(a: Application, mime: string, size: number) {
  editable(a);
  if (
    !formats[mime] ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > proofLimit
  )
    throw new DomainError(
      "Choose a PNG, JPEG or WebP image no larger than 5 MB.",
    );
  const id = randomUUID();
  const proof: PaymentProof = {
    id,
    applicationId: a.id,
    path: `${a.id}/${id}-original.${formats[mime]}`,
    status: "pending",
    mime,
    size,
    createdAt: new Date().toISOString(),
  };
  await save(proof);
  if (isDemo())
    return { proofId: id, uploadUrl: "/api/payment/proof/upload", local: true };
  const { data, error } = await service()
    .storage.from(bucket)
    .createSignedUploadUrl(proof.path);
  if (error)
    throw new DomainError(
      "Could not prepare the upload. Your application is saved; please retry.",
      503,
    );
  return { proofId: id, uploadUrl: data.signedUrl, local: false };
}
export async function localUpload(a: Application, id: string, bytes: Buffer) {
  editable(a);
  const proof = await getProof(id);
  if (
    !isDemo() ||
    !proof ||
    proof.applicationId !== a.id ||
    proof.status !== "pending"
  )
    throw new DomainError("Upload not authorised.", 403);
  if (bytes.length !== proof.size || bytes.length > proofLimit)
    throw new DomainError("Screenshot size does not match the upload.");
  await mkdir(path.dirname(localPath(proof.path)), { recursive: true });
  await writeFile(localPath(proof.path), bytes);
}
export async function finalizeProof(a: Application, id: string) {
  editable(a);
  const proof = await getProof(id);
  if (!proof || proof.applicationId !== a.id)
    throw new DomainError("Screenshot not found.", 404);
  if (proof.status === "ready") return proof;
  let bytes: Buffer;
  if (isDemo()) {
    try {
      bytes = await readFile(localPath(proof.path));
    } catch {
      throw new DomainError(
        "Upload incomplete. Choose the screenshot and retry.",
      );
    }
  } else {
    const { data, error } = await service()
      .storage.from(bucket)
      .download(proof.path);
    if (error)
      throw new DomainError(
        "Upload incomplete. Choose the screenshot and retry.",
      );
    bytes = Buffer.from(await data.arrayBuffer());
  }
  if (bytes.length > proofLimit || bytes.length !== proof.size)
    throw new DomainError("Invalid screenshot size.");
  let clean: Buffer;
  try {
    const image = sharp(bytes, {
      limitInputPixels: 25000000,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (meta.format !== formats[proof.mime] || (meta.pages || 1) !== 1)
      throw new Error("Not a supported still image");
    clean = await image
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toBuffer();
    if (clean.length > 3 * 1024 * 1024) throw new Error("Image is too complex");
  } catch {
    throw new DomainError(
      "This file could not be read as a valid PNG, JPEG or WebP screenshot. Please export a new still image and retry.",
    );
  }
  const original = proof.path;
  proof.path = `${a.id}/${id}.jpg`;
  proof.mime = "image/jpeg";
  proof.size = clean.length;
  proof.status = "ready";
  if (isDemo()) await writeFile(localPath(proof.path), clean);
  else {
    const { error } = await service()
      .storage.from(bucket)
      .upload(proof.path, clean, { contentType: "image/jpeg", upsert: true });
    if (error)
      throw new DomainError(
        "Screenshot processing could not finish. Please retry.",
        503,
      );
  }
  await save(proof);
  if (isDemo()) await unlink(localPath(original)).catch(() => {});
  else await service().storage.from(bucket).remove([original]);
  return proof;
}
export async function proofImage(proof: PaymentProof) {
  if (isDemo())
    return {
      url:
        "data:image/jpeg;base64," +
        (await readFile(localPath(proof.path))).toString("base64"),
    };
  const { data, error } = await service()
    .storage.from(bucket)
    .createSignedUrl(proof.path, 60);
  if (error) throw new DomainError("Screenshot could not be opened.", 503);
  return { url: data.signedUrl };
}
