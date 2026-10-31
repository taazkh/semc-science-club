"use client";

import {
  useRef,
  useEffect,
  type CSSProperties,
  type ReactNode,
  type MouseEventHandler,
} from "react";
import Link from "next/link";
import { Renderer, Program, Mesh, Triangle, Color } from "ogl";
import "./specular-button.css";

type ButtonSize = "sm" | "md" | "lg";

export interface SpecularButtonProps {
  children?: ReactNode;
  size?: ButtonSize;
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  followMouse?: boolean;
  proximity?: number;
  disabled?: boolean;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
  type?: "button" | "submit" | "reset";
}

interface ShaderProps {
  radius: number;
  lineColor: string;
  baseColor: string;
  intensity: number;
  shineSize: number;
  shineFade: number;
  thickness: number;
  followMouse: boolean;
  proximity: number;
}

const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  // Dark base stroke hugging the edge for a sense of thickness
  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  // Symmetric specular: the edges facing toward/away from the light both
  // catch a streak. The angular window (size + fade) is measured with an
  // elliptical normal so it varies continuously along straight edges.
  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

const SpecularButton = ({
  children = "Get Started",
  size = "lg",
  radius = 18,
  tint = "#ffffff",
  tintOpacity = 0,
  blur = 0,
  textColor = "#f5f5f5",
  lineColor = "#ffffff",
  baseColor = "#525252",
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  followMouse = true,
  proximity = 250,
  disabled = false,
  href,
  onClick,
  className = "",
  type = "button",
}: SpecularButtonProps) => {
  const btnRef = useRef<HTMLElement | null>(null);
  const fxRef = useRef<HTMLSpanElement>(null);
  const propsRef = useRef<ShaderProps>({} as ShaderProps);

  propsRef.current = {
    radius,
    lineColor,
    baseColor,
    intensity,
    shineSize,
    shineFade,
    thickness,
    followMouse,
    proximity,
  };

  useEffect(() => {
    const btn = btnRef.current;
    const fx = fxRef.current;
    if (!btn || !fx) return;

    const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const initialBounds = btn.getBoundingClientRect();
    let visible =
      initialBounds.width > 0 &&
      initialBounds.height > 0 &&
      initialBounds.bottom > 0 &&
      initialBounds.top < window.innerHeight &&
      initialBounds.right > 0 &&
      initialBounds.left < window.innerWidth;
    let alive = true;
    let failed = false;
    let lost = false;
    let listening = false;
    let renderer: Renderer | null = null;
    let geometry: Triangle | null = null;
    let program: Program | null = null;
    let mesh: Mesh | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let context: WebGL2RenderingContext | null = null;
    const sizeRef = { w: 1, h: 1 };
    let angle = 2.4;
    let targetAngle = angle;
    let bright = 0;
    let targetBright = 0;
    let last = 0;
    let settleUntil = 0;
    let raf = 0;
    const lineC = new Color();
    const baseC = new Color();
    const eligible = () =>
      alive &&
      visible &&
      !document.hidden &&
      !reduced.matches &&
      fine.matches &&
      !disabled &&
      !lost &&
      !failed &&
      !btn.closest("[inert]");
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      targetBright = bright = 0;
    };
    const fallback = () => {
      btn.dataset.renderer = "fallback";
    };
    const detachPointer = () => {
      if (!listening) return;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      listening = false;
    };
    const dispose = () => {
      stop();
      detachPointer();
      canvas?.removeEventListener("webglcontextlost", onLost);
      canvas?.removeEventListener("webglcontextrestored", onRestored);
      const gl = renderer?.gl ?? context;
      if (gl) {
        geometry?.remove();
        if (program) {
          program.remove();
          gl.deleteShader(program.vertexShader);
          gl.deleteShader(program.fragmentShader);
        }
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      canvas?.remove();
      renderer = geometry = program = mesh = canvas = null;
      context = null;
      fallback();
    };
    const paint = () => {
      if (!renderer || !program || !mesh || !eligible()) return false;
      try {
        if (renderer.gl.isContextLost()) return false;
        const p = propsRef.current;
        lineC.set(p.lineColor);
        baseC.set(p.baseColor);
        program.uniforms.uAngle.value = angle;
        program.uniforms.uRadius.value =
          Math.min(p.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
        const line = program.uniforms.uLineColor.value;
        line[0] = lineC.r;
        line[1] = lineC.g;
        line[2] = lineC.b;
        const base = program.uniforms.uBaseColor.value;
        base[0] = baseC.r;
        base[1] = baseC.g;
        base[2] = baseC.b;
        program.uniforms.uIntensity.value = p.intensity * bright;
        program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
        program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
        program.uniforms.uThickness.value = p.thickness * dpr;
        renderer.render({ scene: mesh });
        return true;
      } catch {
        failed = true;
        dispose();
        return false;
      }
    };
    const resize = () => {
      if (!renderer || !program || !eligible()) return;
      const rect = btn.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      sizeRef.w = rect.width;
      sizeRef.h = rect.height;
      renderer.setSize(rect.width + PAD * 2, rect.height + PAD * 2);
      const center = program.uniforms.uCenter.value;
      center[0] = (PAD + rect.width / 2) * dpr;
      center[1] = (PAD + rect.height / 2) * dpr;
      const half = program.uniforms.uHalfSize.value;
      half[0] = (rect.width / 2) * dpr;
      half[1] = (rect.height / 2) * dpr;
      paint();
    };
    const initialise = () => {
      try {
        canvas = document.createElement("canvas");
        const attributes = {
          alpha: true,
          premultipliedAlpha: true,
          antialias: true,
          depth: false,
          powerPreference: "low-power" as WebGLPowerPreference,
        };
        context = canvas.getContext(
          "webgl2",
          attributes,
        ) as WebGL2RenderingContext | null;
        if (!context) {
          failed = true;
          dispose();
          return false;
        }
        renderer = new Renderer({ ...attributes, canvas, webgl: 2, dpr });
        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        geometry = new Triangle(gl);
        if (geometry.attributes.uv) {
          gl.deleteBuffer(geometry.attributes.uv.buffer ?? null);
          delete geometry.attributes.uv;
        }
        program = new Program(gl, {
          vertex: VERT,
          fragment: FRAG,
          uniforms: {
            uCenter: { value: [0, 0] },
            uHalfSize: { value: [1, 1] },
            uRadius: { value: 0 },
            uAngle: { value: 2.4 },
            uPx: { value: dpr },
            uLineColor: { value: [1, 1, 1] },
            uBaseColor: { value: [0.32, 0.32, 0.32] },
            uIntensity: { value: 0 },
            uShineSize: { value: 0.17 },
            uShineFade: { value: 0.7 },
            uThickness: { value: dpr },
            uBaseWidth: { value: dpr },
          },
        });
        if (!gl.getProgramParameter(program.program, gl.LINK_STATUS))
          throw new Error("Specular shader unavailable");
        mesh = new Mesh(gl, { geometry, program });
        canvas.addEventListener("webglcontextlost", onLost);
        canvas.addEventListener("webglcontextrestored", onRestored);
        fx.appendChild(canvas);
        resize();
        return !!renderer;
      } catch {
        failed = true;
        dispose();
        return false;
      }
    };
    const update = (now: number) => {
      raf = 0;
      if (!eligible()) {
        stop();
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const diff =
        ((targetAngle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += diff * (1 - Math.exp(-dt * 20));
      bright += (targetBright - bright) * (1 - Math.exp(-dt * 24));
      const settled =
        now >= settleUntil ||
        (Math.abs(diff) < 0.002 && Math.abs(targetBright - bright) < 0.002);
      if (settled) {
        angle = targetAngle;
        bright = targetBright;
      }
      if (paint() && !settled) raf = requestAnimationFrame(update);
    };
    const wake = () => {
      if (!eligible() || !renderer) return;
      const now = performance.now();
      settleUntil = now + 240;
      if (!raf) {
        last = now;
        raf = requestAnimationFrame(update);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!eligible() || e.pointerType === "touch") return;
      const rect = btn.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      let pointerAngle: number;
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2);
        const ny = (cy - e.clientY) / (rect.height / 2);
        pointerAngle =
          Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1));
      targetBright = t * t * (3 - 2 * t);
      if (!targetBright && !bright && !raf) return;
      targetAngle = propsRef.current.followMouse ? pointerAngle : 2.4;
      wake();
    };
    const onPointerOut = (e: PointerEvent) => {
      if (e.relatedTarget || !eligible()) return;
      targetBright = 0;
      wake();
    };
    const synchronise = () => {
      if (!eligible()) {
        stop();
        detachPointer();
        fallback();
        if (reduced.matches || !fine.matches) dispose();
        return;
      }
      if (!renderer && !initialise()) return;
      btn.dataset.renderer = "ready";
      resize();
      if (!listening) {
        window.addEventListener("pointermove", onPointerMove, {
          passive: true,
        });
        window.addEventListener("pointerout", onPointerOut, { passive: true });
        listening = true;
      }
    };
    function onLost(event: Event) {
      event.preventDefault();
      lost = true;
      stop();
      detachPointer();
      fallback();
    }
    function onRestored() {
      dispose();
      lost = failed = false;
      synchronise();
    }
    const ro = new ResizeObserver(synchronise);
    ro.observe(btn);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      synchronise();
    });
    observer.observe(btn);
    reduced.addEventListener("change", synchronise);
    fine.addEventListener("change", synchronise);
    document.addEventListener("visibilitychange", synchronise);
    synchronise();

    return () => {
      alive = false;
      ro.disconnect();
      observer.disconnect();
      reduced.removeEventListener("change", synchronise);
      fine.removeEventListener("change", synchronise);
      document.removeEventListener("visibilitychange", synchronise);
      dispose();
    };
  }, [disabled]);

  const visualStyle = {
    "--sb-radius": `${radius}px`,
    "--sb-tint": tint,
    "--sb-tint-opacity": tintOpacity,
    "--sb-blur": `${blur}px`,
    "--sb-text-color": textColor,
  } as CSSProperties;
  const visualClass = `specular-button specular-button--${size}${className ? ` ${className}` : ""}`;
  const content = (
    <>
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </>
  );
  const ref = (element: HTMLElement | null) => {
    btnRef.current = element;
  };
  if (href)
    return (
      <Link
        ref={ref}
        href={href}
        className={visualClass}
        style={visualStyle}
        data-renderer="fallback"
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={(event) => {
          if (disabled) event.preventDefault();
          else onClick?.(event);
        }}
      >
        {content}
      </Link>
    );
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={visualClass}
      style={visualStyle}
      data-renderer="fallback"
    >
      {content}
    </button>
  );
};

export default SpecularButton;
