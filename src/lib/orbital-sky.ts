// Illustrative Keplerian belts, not a map of actual planets or live observations.
export const ORBIT_BANDS = [
  [0.9, 1.35, 0.05, 0.03, 0.16],
  [1.7, 2.35, 0.09, 0.055, 0.24],
  [2.9, 3.9, 0.14, 0.09, 0.3],
  [4.6, 5.4, 0.1, 0.32, 0.14],
  [6.3, 8.6, 0.26, 0.24, 0.16],
] as const;

export function meanMotion(a: number) {
  return 0.42 / a ** 1.5;
}
export function eccentricAnomaly(mean: number, eccentricity: number) {
  const m = ((mean % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let e = m + eccentricity * Math.sin(m);
  for (let i = 0; i < 4; i++)
    e -=
      (e - eccentricity * Math.sin(e) - m) /
      Math.max(0.15, 1 - eccentricity * Math.cos(e));
  return e;
}

export function orbitalElements(count: number) {
  let state = 2026;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const values = new Float32Array(count * 8);
  values[7] = -1;
  for (let i = 1; i < count; i++) {
    let roll = random();
    const band = ORBIT_BANDS.find((b) => (roll -= b[4]) <= 0) ?? ORBIT_BANDS[4];
    const a = band[0] + random() * (band[1] - band[0]);
    values.set(
      [
        a,
        Math.abs(random() + random() - 1) * band[2],
        (random() + random() - 1) * band[3],
        random() * Math.PI * 2,
        random() * Math.PI * 2,
        random() * Math.PI * 2,
        meanMotion(a),
        Math.max(0.00001, random()),
      ],
      i * 8,
    );
  }
  return values;
}

const vertex = `#version 300 es
precision highp float;
layout(location=0) in vec4 aOrb1;
layout(location=1) in vec4 aOrb2;
uniform float uTime, uYaw, uPitch, uAspect, uPx;
uniform vec3 uCool, uWarm, uWhite;
out vec3 vColor;
out float vAlpha;
vec2 turn(vec2 p, float a) { return mat2(cos(a),sin(a),-sin(a),cos(a))*p; }
void main() {
  bool star = aOrb2.w < 0.0;
  float a = aOrb1.x, e = aOrb1.y;
  float M = mod(aOrb2.y + aOrb2.z * uTime, 6.28318530718);
  float E = M + e*sin(M);
  for(int j=0;j<4;j++) E -= (E-e*sin(E)-M)/max(.15,1.0-e*cos(E));
  vec2 plane = turn(vec2(a*(cos(E)-e),a*sqrt(1.0-e*e)*sin(E)),aOrb2.x);
  vec3 w = vec3(plane.x,plane.y*cos(aOrb1.z),plane.y*sin(aOrb1.z));
  w.xy = turn(w.xy,aOrb1.w);
  if(star) w=vec3(0.0);
  w.xy = turn(w.xy,uYaw);
  w.yz = turn(w.yz,uPitch);
  float depth = 24.0 - w.z;
  float scale = 2.246;
  float offset = uAspect > 1.1 ? .30 : .0;
  gl_Position = vec4(w.x*scale/uAspect+offset*depth,w.y*scale+.02*depth,.5*depth,depth);
  float big = step(.985,aOrb2.w);
  gl_PointSize = uPx*(star ? 26.0 : 1.0+big*3.4)*(26.0/max(2.0,depth));
  vColor = star ? uWhite : mix(uCool,uWarm,smoothstep(.65,1.0,aOrb2.w));
  vAlpha = star ? 1.0 : (.20+.55*fract(aOrb2.w*13.7))*(1.0+big*2.2)*(.62+.38*smoothstep(-1.6,1.6,-w.z));
}`;
const fragment = `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main(){
  float d=length(gl_PointCoord*2.0-1.0);
  if(d>1.0) discard;
  outColor=vec4(vColor,(exp(-d*6.5)+exp(-d*1.7)*.3)*vAlpha);
}`;

export type SkyController = {
  pause(value: boolean): void;
  reduce(value: boolean): void;
  turn(amount: number): void;
  dispose(): void;
};

export function createOrbitalSky(
  canvas: HTMLCanvasElement,
  onFailure: () => void,
): SkyController | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!program || !buffer) return null;
  try {
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
        throw new Error("Shader compilation failed");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Shader link failed");
  } catch {
    shaders.forEach((s) => gl.deleteShader(s));
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, orbitalElements(90000), gl.STATIC_DRAW);
  for (let i = 0; i < 2; i++) {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 32, i * 16);
  }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.disable(gl.DEPTH_TEST);
  const uniforms = Object.fromEntries(
    ["Time", "Yaw", "Pitch", "Aspect", "Px", "Cool", "Warm", "White"].map(
      (name) => [name, gl.getUniformLocation(program, `u${name}`)],
    ),
  );
  // Resolve the actual OKLCH tokens into sRGB for WebGL rather than duplicating a palette.
  const swatch = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (!swatch) {
    shaders.forEach((s) => gl.deleteShader(s));
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    return null;
  }
  const css = getComputedStyle(document.documentElement);
  for (const [name, token] of [
    ["Cool", "--accent"],
    ["Warm", "--lavender"],
    ["White", "--foreground"],
  ]) {
    swatch.clearRect(0, 0, 1, 1);
    swatch.fillStyle = css.getPropertyValue(token).trim();
    swatch.fillRect(0, 0, 1, 1);
    const color = swatch.getImageData(0, 0, 1, 1).data;
    gl.uniform3f(
      uniforms[name],
      color[0] / 255,
      color[1] / 255,
      color[2] / 255,
    );
  }
  let paused = false,
    reduced = false,
    lost = false,
    disposed = false,
    frame = 0,
    last = 0;
  let time = 38,
    yaw = -0.32,
    pitch = 1.02;
  let progress = 0,
    width = 0,
    height = 0,
    count = 90000,
    budget = 90000;
  let samples = 0,
    elapsed = 0,
    measured = 0;
  const clampPitch = () => {
    pitch = Math.max(0.16, Math.min(Math.PI - 0.16, pitch));
  };
  const scroll = () => {
    progress = Math.min(
      1,
      Math.max(
        0,
        window.scrollY /
          Math.max(1, document.documentElement.scrollHeight - innerHeight),
      ),
    );
  };
  const resize = () => {
    const w = innerWidth,
      h = innerHeight;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const dpr = Math.max(
      1,
      Math.min(
        coarse ? 1.5 : 2,
        devicePixelRatio || 1,
        Math.sqrt(2600000 / (w * h)),
      ),
    );
    const nextW = Math.round(w * dpr),
      nextH = Math.round(h * dpr);
    if (width !== nextW || height !== nextH) {
      width = nextW;
      height = nextH;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    count = Math.min(
      budget,
      reduced ? 14000 : w < 768 ? 22000 : w < 1100 ? 45000 : 90000,
    );
    canvas.dataset.bodies = String(count);
    gl.uniform1f(uniforms.Aspect, w / h);
    gl.uniform1f(uniforms.Px, 0.62 * dpr);
  };
  const draw = () => {
    if (lost || disposed) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uniforms.Time, time);
    gl.uniform1f(uniforms.Yaw, yaw);
    gl.uniform1f(uniforms.Pitch, pitch);
    gl.drawArrays(gl.POINTS, 0, count);
    canvas.dataset.ready = "true";
  };
  const active = () =>
    !paused && !reduced && !lost && !disposed && !document.hidden;
  const tick = (now: number) => {
    frame = 0;
    if (!active()) return;
    const raw = last ? (now - last) / 1000 : 0;
    last = now;
    const dt = Math.min(0.05, raw);
    time += dt * (0.85 + progress * 5.5);
    pitch += (1.02 + progress * 0.1 - pitch) * (1 - Math.exp(-dt * 0.8));
    clampPitch();
    draw();
    if (raw > 0) {
      samples++;
      elapsed += raw;
      measured += raw;
    }
    if (elapsed >= 2) {
      canvas.dataset.fps = (samples / elapsed).toFixed(1);
      // Bound work on slow hardware; never increase particle counts in response to noise.
      if (measured > 4 && elapsed / samples > 0.034 && budget > 14000) {
        budget = Math.max(14000, Math.floor(Math.min(count, budget) * 0.65));
        resize();
      }
      samples = 0;
      elapsed = 0;
    }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    canvas.dataset.running = String(active());
    if (active()) frame = requestAnimationFrame(tick);
    else draw();
  };
  const resized = () => {
    resize();
    if (!active()) draw();
  };
  const contextLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    sync();
    onFailure();
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  window.addEventListener("resize", resized);
  window.addEventListener("scroll", scroll, { passive: true });
  document.addEventListener("visibilitychange", sync);
  scroll();
  resize();
  draw();
  sync();
  return {
    pause(value) {
      paused = value;
      sync();
    },
    reduce(value) {
      reduced = value;
      resize();
      sync();
    },
    turn(amount) {
      if (reduced) return;
      yaw += amount;
      draw();
    },
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", resized);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("webglcontextlost", contextLost);
      shaders.forEach((s) => gl.deleteShader(s));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
