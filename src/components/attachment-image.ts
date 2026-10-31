export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const imageTypes = ["image/png", "image/jpeg", "image/webp"];
export const attachmentImageError =
  "Choose a PNG, JPEG or WebP image up to 5 MB.";

export function isAttachmentImage(file: Pick<File, "type" | "size">) {
  return (
    imageTypes.includes(file.type) &&
    file.size > 0 &&
    file.size <= MAX_ATTACHMENT_BYTES
  );
}

// Browsers may provide the image source in HTML and its enclosing link as a URI.
export function droppedImageUrl({
  imageSrc,
  uriList,
  text,
}: {
  imageSrc?: string | null;
  uriList?: string;
  text?: string;
}) {
  const candidates = [
    imageSrc,
    ...(uriList || "").split(/\r?\n/).filter((line) => !line.startsWith("#")),
    text,
  ];
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    try {
      const url = new URL(candidate.trim());
      if (url.username || url.password) continue;
      if (["https:", "http:", "blob:"].includes(url.protocol)) return url.href;
      if (
        url.protocol === "data:" &&
        /^data:image\/(png|jpeg|webp);base64,/i.test(url.href) &&
        url.href.length <= Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 64
      )
        return url.href;
    } catch {
      // Ignore non-URL text included with the drag.
    }
  }
  return null;
}

export async function importDroppedImage(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  const type = (response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (
    !response.ok ||
    !imageTypes.includes(type) ||
    Number(response.headers.get("content-length")) > MAX_ATTACHMENT_BYTES
  ) {
    await response.body?.cancel();
    throw new Error(attachmentImageError);
  }
  if (!response.body) throw new Error(attachmentImageError);
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ATTACHMENT_BYTES) {
        await reader.cancel();
        throw new Error(attachmentImageError);
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new Error(attachmentImageError);
  const extension = type === "image/jpeg" ? "jpg" : type.slice(6);
  const source = new URL(url);
  const base =
    source.protocol === "http:" || source.protocol === "https:"
      ? (source.pathname.split("/").pop() || "dropped-image")
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .replace(/\.[^.]*$/, "")
          .slice(0, 100)
      : "dropped-image";
  return new File(chunks, `${base || "dropped-image"}.${extension}`, { type });
}
