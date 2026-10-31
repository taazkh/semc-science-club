"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { SpotlightLayer } from "./react-bits/spotlight-layer";

// Bounded edge map with inward bevels follows the Meniscus public CSS recipe.
// The map is generated once per size change; no DOM capture or animation loop.
function edgeMap(width: number, height: number, radius: number, bezel: number) {
  const ratio = Math.min(1, 512 / width, 384 / height);
  const w = Math.max(2, Math.round(width * ratio));
  const h = Math.max(2, Math.round(height * ratio));
  const r = Math.min(radius * ratio, w / 2, h / 2);
  const band = Math.max(1, bezel * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const pixels = context.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - w / 2,
        dy = y + 0.5 - h / 2;
      const qx = Math.abs(dx) - (w / 2 - r),
        qy = Math.abs(dy) - (h / 2 - r);
      const ox = Math.max(qx, 0),
        oy = Math.max(qy, 0),
        length = Math.hypot(ox, oy);
      const distance = -(length + Math.min(Math.max(qx, qy), 0) - r);
      const bend =
        distance > 0 && distance < band ? Math.pow(1 - distance / band, 2) : 0;
      const nx = length
        ? (ox / length) * Math.sign(dx)
        : qx > qy
          ? Math.sign(dx)
          : 0;
      const ny = length
        ? (oy / length) * Math.sign(dy)
        : qx > qy
          ? 0
          : Math.sign(dy);
      const offset = (y * w + x) * 4;
      pixels.data[offset] = 128 - nx * bend * 127;
      pixels.data[offset + 1] = 128 - ny * bend * 127;
      pixels.data[offset + 2] = 128;
      pixels.data[offset + 3] = 255;
    }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}

export function LiquidGlassSurface({
  className = "",
  strength = 28,
  radius = 16,
  bezel = 16,
  spotlight = false,
  resizeDelay = 0,
}: {
  className?: string;
  strength?: number;
  radius?: number;
  bezel?: number;
  spotlight?: boolean;
  resizeDelay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const id = "glass-" + useId().replaceAll(":", "");
  const [optic, setOptic] = useState({
    map: "",
    width: 0,
    height: 0,
    displacement: 0,
  });
  useEffect(() => {
    const element = ref.current;
    const brands = (
      navigator as Navigator & {
        userAgentData?: { brands?: { brand: string }[] };
      }
    ).userAgentData?.brands;
    const chromium =
      brands?.some(({ brand }) =>
        /Chromium|Google Chrome|Microsoft Edge/.test(brand),
      ) || /Chrome|Chromium|Edg\//.test(navigator.userAgent);
    if (!element || !chromium || /iPhone|iPad|iPod/.test(navigator.userAgent))
      return;
    const reducedTransparency = matchMedia(
      "(prefers-reduced-transparency: reduce)",
    );
    const moreContrast = matchMedia("(prefers-contrast: more)");
    let frame = 0,
      size = "";
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const prepare = () => {
      cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      if (reducedTransparency.matches || moreContrast.matches) {
        size = "";
        setOptic({ map: "", width: 0, height: 0, displacement: 0 });
        return;
      }
      const prepareMap = () => {
        frame = requestAnimationFrame(() => {
          const width = element.offsetWidth,
            height = element.offsetHeight;
          const key = `${width}:${height}`;
          if (key === size || width < 1 || height < 1) return;
          size = key;
          const effectiveBezel = Math.max(
            1,
            Math.min(bezel, radius, width / 2, height / 2),
          );
          const displacement = Math.max(
            0,
            Math.min(strength / 2, effectiveBezel * 0.4),
          );
          setOptic({
            map: edgeMap(width, height, radius, effectiveBezel),
            width,
            height,
            displacement,
          });
        });
      };
      if (size && resizeDelay > 0)
        resizeTimer = setTimeout(prepareMap, resizeDelay);
      else prepareMap();
    };
    const observer = new ResizeObserver(prepare);
    observer.observe(element);
    reducedTransparency.addEventListener("change", prepare);
    moreContrast.addEventListener("change", prepare);
    prepare();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      observer.disconnect();
      reducedTransparency.removeEventListener("change", prepare);
      moreContrast.removeEventListener("change", prepare);
    };
  }, [radius, bezel, strength, resizeDelay]);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`liquid-glass-surface ${className}`}
      data-refraction={optic.map ? "optical" : "fallback"}
      style={
        {
          "--optical-filter": optic.map ? `url(#${id})` : "none",
          borderRadius: radius,
        } as CSSProperties
      }
    >
      <svg className="effect-definitions" aria-hidden="true">
        <defs>
          <filter
            id={id}
            x="0"
            y="0"
            width={optic.width || 1}
            height={optic.height || 1}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={optic.map || undefined}
              x="0"
              y="0"
              width={optic.width || 1}
              height={optic.height || 1}
              preserveAspectRatio="none"
              result="edge-map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="edge-map"
              scale={optic.displacement * 2}
              xChannelSelector="R"
              yChannelSelector="G"
              result="refracted"
            />
            <feGaussianBlur
              in="refracted"
              stdDeviation="0.5"
              result="softened"
            />
            <feColorMatrix in="softened" type="saturate" values="1.08" />
          </filter>
        </defs>
      </svg>
      <span className="glass-refraction" />
      <span className="glass-tint" />
      {spotlight && <SpotlightLayer />}
      <span className="glass-highlight" />
    </span>
  );
}
