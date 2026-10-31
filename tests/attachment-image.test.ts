import test from "node:test";
import assert from "node:assert/strict";
import {
  attachmentImageError,
  droppedImageUrl,
  importDroppedImage,
  isAttachmentImage,
  MAX_ATTACHMENT_BYTES,
} from "../src/components/attachment-image";

test("attachment validation preserves accepted image types and the 5 MB limit", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp"])
    assert.equal(isAttachmentImage({ type, size: MAX_ATTACHMENT_BYTES }), true);
  for (const file of [
    { type: "image/svg+xml", size: 100 },
    { type: "text/html", size: 100 },
    { type: "image/png", size: 0 },
    { type: "image/jpeg", size: MAX_ATTACHMENT_BYTES + 1 },
  ])
    assert.equal(isAttachmentImage(file), false);
});

test("browser image source takes precedence over the enclosing page link", () => {
  assert.equal(
    droppedImageUrl({
      imageSrc: "https://images.example.org/portrait.jpg",
      uriList: "https://example.org/member-profile",
    }),
    "https://images.example.org/portrait.jpg",
  );
  assert.equal(
    droppedImageUrl({
      uriList: "# Dragged image\r\nhttps://images.example.org/photo.png\r\n",
    }),
    "https://images.example.org/photo.png",
  );
});

test("text-only drags reject scripts, filesystem URLs, credentials and non-image data", () => {
  for (const text of [
    "javascript:alert(1)",
    "file:///C:/private/image.png",
    "https://user:password@example.org/photo.jpg",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "arbitrary selected text",
  ])
    assert.equal(droppedImageUrl({ text }), null);
  assert.equal(
    droppedImageUrl({ text: "data:image/png;base64,aGVsbG8=" }),
    "data:image/png;base64,aGVsbG8=",
  );
});

test("browser imports omit credentials and turn readable images into validated files", async (t) => {
  const controller = new AbortController();
  let request: RequestInit | undefined;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      request = init;
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/jpeg; charset=binary" },
      });
    },
  );
  const file = await importDroppedImage(
    "https://images.example.org/portrait.png?token=private",
    controller.signal,
  );
  assert.equal(file.name, "portrait.jpg");
  assert.equal(file.type, "image/jpeg");
  assert.equal(file.size, 3);
  assert.equal(isAttachmentImage(file), true);
  assert.equal(request?.credentials, "omit");
  assert.equal(request?.referrerPolicy, "no-referrer");
  assert.equal(request?.signal, controller.signal);
});

test("HTML pages and oversized responses cannot become selected image files", async (t) => {
  const responseBodies = [
    new Response("not an image", { headers: { "content-type": "text/html" } }),
    new Response("large image", {
      headers: {
        "content-type": "image/png",
        "content-length": String(MAX_ATTACHMENT_BYTES + 1),
      },
    }),
    new Response(new Uint8Array(0), {
      headers: { "content-type": "image/png" },
    }),
  ];
  t.mock.method(globalThis, "fetch", async () => responseBodies.shift());
  for (let index = 0; index < 3; index++)
    await assert.rejects(
      importDroppedImage(
        "https://images.example.org/photo.png",
        new AbortController().signal,
      ),
      { message: attachmentImageError },
    );
});

test("streamed imports stop at 5 MB even without a trustworthy size header", async (t) => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_ATTACHMENT_BYTES));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() {
      cancelled = true;
    },
  });
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(stream, { headers: { "content-type": "image/webp" } }),
  );
  await assert.rejects(
    importDroppedImage(
      "https://images.example.org/photo.webp",
      new AbortController().signal,
    ),
    { message: attachmentImageError },
  );
  assert.equal(cancelled, true);
});

test("blocked browser imports keep the network error available for the download fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    importDroppedImage(
      "https://images.example.org/blocked.png",
      new AbortController().signal,
    ),
    { message: "Failed to fetch" },
  );
});
