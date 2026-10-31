"use client";
import { useEffect, useId, useRef, useState } from "react";
import { notify } from "./feedback-toast";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRightIcon, CheckCircleIcon } from "./icons";
import {
  attachmentImageError,
  droppedImageUrl,
  importDroppedImage,
  isAttachmentImage,
} from "./attachment-image";
export function FileAttachment({
  file,
  preview,
  saved,
  required,
  busy,
  label,
  onChange,
  purpose = "payment",
}: {
  file: File | null;
  preview: string;
  saved: boolean;
  required: boolean;
  busy: boolean;
  label: string;
  onChange: (file: File | null) => void;
  purpose?: "payment" | "content";
}) {
  const input = useRef<HTMLInputElement>(null),
    host = useRef<HTMLDivElement>(null),
    importController = useRef<AbortController | null>(null),
    id = useId();
  const reduced = useReducedMotion();
  const [dragging, setDragging] = useState(false),
    [error, setError] = useState(""),
    [importing, setImporting] = useState(false),
    [animate, setAnimate] = useState(false);
  const working = busy || importing;
  function syncInput(selection: File | null) {
    if (!input.current) return;
    if (!selection) input.current.value = "";
    else {
      const transfer = new DataTransfer();
      transfer.items.add(selection);
      input.current.files = transfer.files;
    }
  }
  useEffect(() => {
    syncInput(file);
  }, [file]);
  useEffect(
    () => () => {
      const controller = importController.current;
      importController.current = null;
      controller?.abort();
    },
    [],
  );
  useEffect(() => {
    let visible = false;
    const sync = () => setAnimate(visible && !document.hidden && working);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    if (host.current) observer.observe(host.current);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [working]);
  const choose = (candidate: File | null) => {
    if (candidate && !isAttachmentImage(candidate)) {
      setError(attachmentImageError);
      syncInput(file);
      notify(attachmentImageError, "error");
      return;
    }
    setError("");
    onChange(candidate);
    if (candidate)
      notify(
        purpose === "payment"
          ? "Screenshot selected. It will upload when you submit payment details."
          : "Image selected. Uploading it does not publish the content.",
      );
  };
  const importImage = async (url: string) => {
    importController.current?.abort();
    const controller = new AbortController();
    importController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setImporting(true);
    setError("");
    try {
      const candidate = await importDroppedImage(url, controller.signal);
      if (importController.current === controller && !controller.signal.aborted)
        choose(candidate);
    } catch (cause) {
      if (importController.current !== controller) return;
      const message =
        cause instanceof Error && cause.message === attachmentImageError
          ? attachmentImageError
          : "This image could not be imported. Download it, then choose the file here.";
      setError(message);
      notify(message, "error");
    } finally {
      window.clearTimeout(timeout);
      if (importController.current === controller) {
        importController.current = null;
        setImporting(false);
      }
    }
  };
  return (
    <div
      ref={host}
      className="proof-upload attachment-tile"
      data-dragging={dragging}
      data-working={animate && working && reduced === false}
      aria-busy={working}
      onDragOver={(e) => {
        e.preventDefault();
        if (!working) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (working) return;
        const candidate = e.dataTransfer.files[0] || null;
        if (candidate) {
          choose(candidate);
          return;
        }
        const html = e.dataTransfer.getData("text/html");
        // Read drag markup in an inert template; never insert it into the page.
        const template = document.createElement("template");
        template.innerHTML = html;
        const imageSrc = template.content
          .querySelector("img")
          ?.getAttribute("src");
        const url = droppedImageUrl({
          imageSrc,
          uriList: e.dataTransfer.getData("text/uri-list"),
          text: e.dataTransfer.getData("text/plain"),
        });
        if (url && purpose === "content") void importImage(url);
        else {
          const message =
            "Drop a PNG, JPEG or WebP image, or download it and choose the file here.";
          setError(message);
          notify(message, "error");
        }
      }}
    >
      <svg className="effect-definitions" aria-hidden="true">
        <defs>
          <filter id={`${id}-squircle`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" />
            <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10" />
          </filter>
        </defs>
      </svg>
      <span
        className="attachment-squircle"
        style={{
          filter: reduced !== false ? undefined : `url(#${id}-squircle)`,
        }}
        aria-hidden="true"
      >
        <i />
      </span>
      <span className="attachment-beam" aria-hidden="true" />
      <motion.span
        className="attachment-file-glyph"
        aria-hidden="true"
        animate={{
          rotate: reduced === false && dragging ? -9 : 0,
          y: reduced === false && dragging ? -4 : 0,
        }}
        transition={{ duration: 0.18 }}
      >
        <ArrowUpRightIcon size={27} />
      </motion.span>
      <label className="field" htmlFor={`${id}-file`}>
        <span>{label}</span>
        <span className="attachment-instruction">
          Drop an image here, or choose a file.
        </span>
      </label>
      <input
        ref={input}
        id={`${id}-file`}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        required={required && !saved && !file}
        disabled={working}
        aria-invalid={!!error}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        onChange={(e) => choose(e.target.files?.[0] || null)}
      />
      <p id={`${id}-help`} className="fine-print">
        PNG, JPEG or WebP · up to 5 MB
      </p>
      {importing && <p role="status">Importing image…</p>}
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
      <AnimatePresence initial={false}>
        {(file || (saved && preview)) && (
          <motion.div
            className="attachment-selected"
            key={file?.name || "saved-image"}
            initial={
              reduced !== false ? false : { opacity: 0, y: 10, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced !== false ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduced !== false ? 0 : 0.2 }}
          >
            <p role="status">
              {file
                ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB`
                : "Current approved image"}
              <br />
              <small>
                {saved
                  ? purpose === "payment"
                    ? "Screenshot saved privately"
                    : "Image uploaded; save the content to publish it"
                  : "Selected, not yet uploaded"}
              </small>
            </p>
            {preview && (
              <img
                className="upload-thumbnail"
                src={preview}
                alt={
                  purpose === "payment"
                    ? "Selected payment screenshot"
                    : "Selected content image"
                }
              />
            )}
            <div className="attachment-actions">
              <svg className="effect-definitions" aria-hidden="true">
                <defs>
                  <filter id={`${id}-goo`}>
                    <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
                    <feColorMatrix
                      type="matrix"
                      values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                    />
                  </filter>
                </defs>
              </svg>
              <span
                className="attachment-goo"
                style={{ filter: `url(#${id}-goo)` }}
                aria-hidden="true"
              >
                <i />
                <i />
              </span>
              <button
                type="button"
                disabled={working}
                onClick={() => input.current?.click()}
              >
                Replace
              </button>
              <button
                type="button"
                disabled={working}
                onClick={() => {
                  choose(null);
                  if (input.current) input.current.value = "";
                }}
              >
                Remove
              </button>
            </div>
            {saved && (
              <span className="attachment-saved-mark">
                <CheckCircleIcon size={18} aria-hidden="true" />
                Uploaded
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
