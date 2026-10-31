import { makeParticles, scrollSpeed } from "./orbits";

export type Diagnostics = {
  frames: number;
  time: number;
  speed: number;
  particles: number;
  pixels: number;
  running: boolean;
  yaw: number;
  pitch: number;
  distance: number;
  scrollProgress: number;
  velocity: number;
  samples: number[];
  quality: number;
};
declare global {
  interface Window {
    __orbitalStudy?: { active: number; current: Diagnostics | null };
  }
}

const vertex = `#version 300 es
precision highp float;
layout(location=0) in vec4 orbit;
layout(location=1) in vec4 detail;
uniform float time; uniform float aspect; uniform float pixelRatio;
uniform float cameraDistance; uniform float projectionFit; uniform float verticalOffset;
uniform vec2 camera;
out float alpha; out float primary;
const float TAU=6.28318530718;
vec2 rotate2(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
void main(){
 bool star=detail.w<0.; vec3 p=vec3(0.);
 if(!star){
  float a=orbit.x,e=orbit.y;
  float M=mod(detail.y+0.42/pow(a,1.5)*time,TAU);
  float E=M+e*sin(M);
  for(int k=0;k<4;k++) E-=(E-e*sin(E)-M)/max(0.15,1.-e*cos(E));
  vec2 plane=rotate2(vec2(a*(cos(E)-e),a*sqrt(1.-e*e)*sin(E)),detail.x);
  p=vec3(plane.x,plane.y*cos(orbit.z),plane.y*sin(orbit.z));
  p.xy=rotate2(p.xy,orbit.w);
 }
 p.xy=rotate2(p.xy,camera.x); p.yz=rotate2(p.yz,camera.y);
 float depth=cameraDistance-p.z;
 float focal=1./tan(0.72/2.)*projectionFit;
 float clipDepth=(100.1/99.9)*depth-(20./99.9);
 gl_Position=vec4(p.x*focal/aspect,p.y*focal-verticalOffset*depth,clipDepth,depth);
 gl_PointSize=min(48.,pixelRatio*(star?26.:1.+detail.z*3.4)*26./max(2.,depth));
 alpha=star?1.:(0.20+0.55*fract(detail.w*13.7))*(1.+detail.z*2.2)*(0.62+0.38*smoothstep(-1.6,1.6,-p.z));
 primary=star?1.:0.;
}`;
const fragment = `#version 300 es
precision highp float;
in float alpha; in float primary; uniform vec3 color; out vec4 result;
void main(){vec2 q=gl_PointCoord*2.-1.;float d=dot(q,q);if(d>1.)discard;
 float glow=exp(-d*6.5)+exp(-d*1.7)*0.3;
 vec3 tone=mix(color,vec3(0.95,1.,1.),primary*0.6);
 result=vec4(tone,min(1.,glow*alpha));
}`;

export function createRenderer(
  canvas: HTMLCanvasElement,
  color: [number, number, number],
  failed: () => void,
  verticalOffset = 0,
) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    failed();
    return null;
  }
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null,
    buffer: WebGLBuffer | null = null,
    vao: WebGLVertexArrayObject | null = null;
  const disposeGPU = () => {
    if (buffer) gl.deleteBuffer(buffer);
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
    shaders.forEach((s) => gl.deleteShader(s));
  };
  try {
    program = gl.createProgram();
    if (!program) throw new Error("WebGL program unavailable");
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Shader unavailable");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) ?? "Shader failed");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("WebGL link failed");
    buffer = gl.createBuffer();
    vao = gl.createVertexArray();
    if (!buffer || !vao) throw new Error("WebGL allocation failed");
  } catch {
    disposeGPU();
    failed();
    return null;
  }
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const maximum = innerWidth < 768 ? 22000 : innerWidth < 1100 ? 45000 : 90000;
  gl.bufferData(gl.ARRAY_BUFFER, makeParticles(maximum), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.disable(gl.DEPTH_TEST);
  const uniforms = Object.fromEntries(
    [
      "time",
      "aspect",
      "pixelRatio",
      "camera",
      "color",
      "cameraDistance",
      "projectionFit",
      "verticalOffset",
    ].map((k) => [k, gl.getUniformLocation(program!, k)]),
  );
  gl.uniform3fv(uniforms.color, color);
  gl.uniform1f(uniforms.verticalOffset, verticalOffset);
  gl.clearColor(0, 0, 0, 0);

  const diagnostics: Diagnostics = {
    frames: 0,
    time: 12,
    speed: 0.85,
    particles: maximum,
    pixels: 0,
    running: false,
    yaw: 0.4,
    pitch: 1.06,
    distance: 15.4,
    scrollProgress: 0,
    velocity: 0,
    samples: [],
    quality: 1,
  };
  const registry = (window.__orbitalStudy ??= { active: 0, current: null });
  registry.active++;
  registry.current = diagnostics;
  let disposed = false,
    lost = false,
    enabled = false,
    visible = true,
    frame = 0,
    last = 0;
  let width = 1,
    height = 1,
    ratio = 1,
    sampleIndex = 0,
    slowFrames = 0,
    budgetFrames = 0,
    elapsed = 0;
  let projectionFit = 1,
    scrollRange = 0;
  const onScroll = () => {
    diagnostics.scrollProgress =
      scrollRange > 0
        ? Math.min(1, Math.max(0, window.scrollY / scrollRange))
        : 0;
    diagnostics.speed = scrollSpeed(diagnostics.scrollProgress);
  };
  const measureScroll = () => {
    scrollRange = Math.max(
      0,
      Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      ) - innerHeight,
    );
    onScroll();
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    projectionFit = Math.min(1, (width / height) ** 1.3);
    ratio =
      Math.min(
        devicePixelRatio || 1,
        innerWidth < 768 ? 1.5 : 2,
        Math.sqrt(2600000 / (width * height)),
      ) * (diagnostics.quality <= 0.4 ? 0.85 : 1);
    const w = Math.max(1, Math.floor(width * ratio)),
      h = Math.max(1, Math.floor(height * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    diagnostics.pixels = w * h;
    const tier = innerWidth < 768 ? 22000 : innerWidth < 1100 ? 45000 : 90000;
    diagnostics.particles = Math.max(
      6000,
      Math.floor(Math.min(maximum, tier) * diagnostics.quality),
    );
  };
  const draw = () => {
    if (disposed || lost || document.hidden || !visible) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uniforms.time, diagnostics.time);
    gl.uniform1f(uniforms.aspect, width / height);
    gl.uniform1f(uniforms.pixelRatio, ratio * 0.62);
    gl.uniform1f(uniforms.cameraDistance, diagnostics.distance);
    gl.uniform1f(uniforms.projectionFit, projectionFit);
    gl.uniform2f(uniforms.camera, diagnostics.yaw, diagnostics.pitch);
    gl.drawArrays(gl.POINTS, 0, diagnostics.particles);
    diagnostics.frames++;
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    diagnostics.running = false;
  };
  const tick = (now: number) => {
    frame = 0;
    if (disposed || lost || !enabled || document.hidden || !visible) {
      stop();
      return;
    }
    const ms = last ? now - last : 0;
    last = now;
    const dt = Math.min(0.05, ms / 1000);
    diagnostics.time += dt * diagnostics.speed;
    diagnostics.yaw += dt * 0.014;
    diagnostics.pitch +=
      (1.06 - diagnostics.scrollProgress * 0.55 - diagnostics.pitch) *
      (1 - Math.pow(1 - 0.018, dt * 60));
    diagnostics.distance +=
      (15.4 - diagnostics.scrollProgress * 3.4 - diagnostics.distance) *
      (1 - Math.pow(1 - 0.05, dt * 60));
    if (ms > 0) {
      diagnostics.samples[sampleIndex++ % 240] = ms;
      elapsed += ms;
      budgetFrames++;
      if (ms > 26) slowFrames++;
      if (elapsed >= 2500) {
        if (slowFrames / budgetFrames > 0.35 && diagnostics.quality > 0.4) {
          diagnostics.quality = Math.max(0.4, diagnostics.quality * 0.75);
          resize();
        }
        elapsed = slowFrames = budgetFrames = 0;
      }
    }
    draw();
    diagnostics.running = true;
    frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (
      !frame &&
      !disposed &&
      !lost &&
      enabled &&
      visible &&
      !document.hidden
    ) {
      last = 0;
      diagnostics.running = true;
      frame = requestAnimationFrame(tick);
    }
  };
  const sync = () => {
    stop();
    if (enabled) start();
    else draw();
  };
  const onResize = () => {
    measureScroll();
    resize();
    if (!enabled) draw();
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    stop();
    failed();
  };
  const observer = new ResizeObserver(onResize);
  observer.observe(canvas);
  const pageObserver = new ResizeObserver(measureScroll);
  pageObserver.observe(document.documentElement);
  pageObserver.observe(document.body);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    sync();
  });
  intersection.observe(canvas);
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", sync);
  canvas.addEventListener("webglcontextlost", contextLost);
  measureScroll();
  resize();
  draw();
  return {
    inspect() {
      return {
        ...diagnostics,
        samples: [...diagnostics.samples],
        active: registry.active,
      };
    },
    setEnabled(value: boolean) {
      enabled = value;
      diagnostics.velocity = 0;
      sync();
    },
    dispose() {
      disposed = true;
      stop();
      observer.disconnect();
      pageObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("webglcontextlost", contextLost);
      disposeGPU();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      registry.active--;
      if (registry.current === diagnostics) registry.current = null;
    },
  };
}
