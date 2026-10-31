"use client";
import { useId, useRef, type ReactNode } from "react";
import { useReveal } from "@/lib/redesign/reveal";
import {
  circumcircle,
  pendulumPeriod,
  lensImage,
  linePosition,
  drive,
  graphEdges,
  shortestPath,
  frontFaceTurn,
  triangleTruss,
  rayWall,
} from "@/lib/redesign/science-models";

const descriptions: Record<string, [string, string, string]> = {
  "project-display": [
    "Experiment → evidence",
    "For small swings, a pendulum's period is T = 2π√(L/g). The highlighted example follows the straight T²-versus-L relationship. Ideal model; g = 9.81 m/s².",
    "Pendulum length",
  ],
  "robot-race": [
    "Wheel speed → trajectory",
    "Two driven wheels determine a robot's path. Equal speeds give a straight line; unequal speeds give an arc. The prediction uses a 0.32 m wheel separation and 0.8 seconds of travel, without wheel slip.",
    "Wheel-speed difference",
  ],
  "robot-soccer": [
    "Position → approach",
    "A robot approaches behind the ball, on the line to the goal centre. The approach point and aiming line share the ball-to-goal axis. This is an ideal alignment study, not a complete autonomous strategy.",
    "Ball position",
  ],
  "line-follower": [
    "Reflectance → steering",
    "Five sensors estimate a line's position using a weighted average. The offset from the centre sensor determines the steering direction. Sensor responses here are a smooth illustrative model.",
    "Line position",
  ],
  "math-olympiad": [
    "Construction → proof",
    "The perpendicular bisectors of a triangle meet at its circumcentre. The constructed circle passes through all three vertices, so the three radii are equal.",
    "Upper vertex position",
  ],
  "physics-olympiad": [
    "Light → image",
    "A thin converging lens obeys 1/f = 1/u + 1/v. The parallel ray refracts through the far focus; the central ray stays straight. Changing object distance changes the inverted image's size and position.",
    "Object distance",
  ],
  "bio-chem-olympiad": [
    "Catalysis → lower barrier",
    "An enzyme provides a lower activation-energy pathway, without changing the reactant or product energy. The enzyme is regenerated: E + S ⇌ ES → E + P. Curves are schematic, with equal endpoints.",
    "Reaction progress",
  ],
  "programming-contest": [
    "Search → shortest path",
    "Dijkstra's algorithm settles the cheapest remaining node in a graph with nonnegative weights. The shortest A-to-F route is A → C → E → F, with total cost 8.",
    "Search step",
  ],
  "wall-magazine": [
    "Evidence → explanation",
    "A scientific editorial spread links a clearly labelled relationship to its caption and interpretation. The example plots the ideal period squared against pendulum length, connecting evidence with explanation.",
    "Editorial emphasis",
  ],
  "scientific-art": [
    "Superposition → pattern",
    "Two coherent sources form an interference pattern. Dots show time-averaged relative intensity, calculated from their path difference. Changing source separation moves constructive and destructive regions.",
    "Source separation",
  ],
  "treasure-hunt": [
    "Bearings → location",
    "Two bearings measured clockwise from north locate a point where their rays intersect. This abstract coordinate field is not a campus map or festival clue.",
    "Target position",
  ],
  "speed-cubing": [
    "Permutation → face turn",
    "A clockwise turn permutes eight facelets around a fixed centre. Compare the same numbered face before and after a legal quarter-turn. Adjacent-face strips are omitted; four turns restore the original face.",
    "Clockwise quarter-turns",
  ],
  "bridge-building": [
    "Load → equilibrium",
    "A triangular pin-jointed truss carries a load at its apex. Both supports carry half the vertical load. The sloping members are in compression and the bottom tie is in tension. Span 4 m; height 1.7 m; self-weight omitted.",
    "Apex load",
  ],
  "fifa-tournament": [
    "Position → passing lane",
    "A defender can block the direct passing lane. A third player creates a triangular alternative. Compare the blocked direct route with the pass through the upper player. This is an abstract tactical study.",
    "Defender position",
  ],
  "clash-royale-tournament": [
    "Bridge → route choice",
    "Two bridges connect opposite sides of an abstract arena. The selected route crosses the river at the right bridge. Generic geometry illustrates routing, not game artwork or tournament rules.",
    "Bridge choice",
  ],
  "pubg-tournament": [
    "Cover → zone rotation",
    "A smaller next zone lies inside the current zone. Two candidate routes pass around an obstacle and finish inside the next zone. This is not a real map or a safety guarantee.",
    "Next-zone position",
  ],
  "valorant-tournament": [
    "Cover → sight lines",
    "Rays stop where they hit a wall; rays that miss continue to the boundary. The wall determines which angles are blocked. This is geometric visibility, not a prediction of game outcomes.",
    "Observer position",
  ],
};
const L = ({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) => (
  <text
    x={x}
    y={y}
    stroke="none"
    fill="currentColor"
    className={y >= 300 ? "diagram-label diagram-note" : "diagram-label"}
  >
    {children}
  </text>
);
const Stage = ({ n, children }: { n: number; children: ReactNode }) => (
  <g data-stage={n}>{children}</g>
);
const P = ({ d, ...rest }: React.SVGProps<SVGPathElement>) => (
  <path d={d} {...rest} />
);
function Arrow({
  x,
  y,
  dx,
  dy,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
}) {
  const len = Math.hypot(dx, dy) || 1,
    ux = dx / len,
    uy = dy / len,
    ex = x + dx,
    ey = y + dy;
  return (
    <P
      d={`M${x} ${y}L${ex} ${ey}M${ex - 8 * ux + 4 * uy} ${ey - 8 * uy - 4 * ux}L${ex} ${ey}L${ex - 8 * ux - 4 * uy} ${ey - 8 * uy + 4 * ux}`}
    />
  );
}
function Drawing({ kind, t }: { kind: string; t: number }) {
  switch (kind) {
    case "project-display": {
      const length = 0.4 + t,
        extent = 70 + length * 80,
        x = 145 + Math.sin(0.16) * extent,
        y = 45 + Math.cos(0.16) * extent;
      return (
        <>
          <Stage n={0}>
            <P
              d="M65 295V45H245M145 45V270"
              opacity=".4"
              strokeDasharray="5 6"
            />
            <P d="M330 280V65M330 280H560" />
            <L x={300} y={55}>
              T² (s²)
            </L>
            <L x={500} y={305}>
              L (m)
            </L>
          </Stage>
          <Stage n={1}>
            <P d={`M145 45L${x} ${y}`} strokeWidth={2} />
            <circle cx={x} cy={y} r={13} />
            <P d="M330 280L540 83" />
            {[0.4, 0.6, 0.8, 1, 1.2, 1.4].map((v) => (
              <circle
                key={v}
                cx={330 + v * 150}
                cy={280 - pendulumPeriod(v) ** 2 * 35}
                r={3}
              />
            ))}
          </Stage>
          <Stage n={2}>
            <circle
              cx={330 + length * 150}
              cy={280 - pendulumPeriod(length) ** 2 * 35}
              r={7}
              fill="var(--accent)"
            />
            <L x={x + 18} y={y / 2 + 20}>
              L
            </L>
            <L x={65} y={325}>
              T = {pendulumPeriod(length).toFixed(2)} s
            </L>
            <L x={330} y={325}>
              T² ∝ L
            </L>
          </Stage>
        </>
      );
    }
    case "robot-race": {
      const delta = (t - 0.5) * 1.2,
        m = drive(1 - delta, 1 + delta);
      const points = Array.from({ length: 35 }, (_, i) => {
        const s = (i / 34) * 0.8;
        return Math.abs(m.omega) < 0.001
          ? `300,${265 - s * 170}`
          : `${300 - m.radius * (1 - Math.cos(m.omega * s)) * 170},${265 - m.radius * Math.sin(m.omega * s) * 170}`;
      }).join(" ");
      return (
        <>
          <Stage n={0}>
            <P d="M70 285H540M300 40V320" opacity=".3" strokeDasharray="5 6" />
            <rect x={255} y={230} width={90} height={65} rx={12} />
            <rect x={242} y={242} width={13} height={40} />
            <rect x={345} y={242} width={13} height={40} />
          </Stage>
          <Stage n={1}>
            <polyline points={points} strokeWidth={3} />
            <Arrow x={245} y={225} dx={0} dy={-(1 - delta) * 55} />
            <Arrow x={355} y={225} dx={0} dy={-(1 + delta) * 55} />
          </Stage>
          <Stage n={2}>
            <L x={90} y={85}>
              vL = {(1 - delta).toFixed(2)} m/s
            </L>
            <L x={360} y={85}>
              vR = {(1 + delta).toFixed(2)} m/s
            </L>
            <L x={190} y={335}>
              {Number.isFinite(m.radius)
                ? `Turn radius ${Math.abs(m.radius).toFixed(2)} m`
                : "Equal speeds · straight path"}
            </L>
          </Stage>
        </>
      );
    }
    case "robot-soccer": {
      const bx = 290,
        by = 115 + t * 125,
        dx = 535 - bx,
        dy = 175 - by,
        len = Math.hypot(dx, dy),
        rx = bx - (dx / len) * 95,
        ry = by - (dy / len) * 95;
      return (
        <>
          <Stage n={0}>
            <rect x={55} y={55} width={490} height={240} />
            <P d="M300 55V295M545 135H565V215H545" opacity=".4" />
          </Stage>
          <Stage n={1}>
            <Arrow x={rx} y={ry} dx={535 - rx} dy={175 - ry} />
            <circle cx={rx} cy={ry} r={23} />
            <circle cx={bx} cy={by} r={10} fill="var(--glass-reading)" />
          </Stage>
          <Stage n={2}>
            <L x={rx - 40} y={ry + 45}>
              approach
            </L>
            <L x={bx + 15} y={by + 30}>
              ball
            </L>
            <L x={470} y={325}>
              goal centre
            </L>
          </Stage>
        </>
      );
    }
    case "line-follower": {
      const pos = t * 4,
        responses = Array.from({ length: 5 }, (_, i) =>
          Math.exp(-((i - pos) ** 2) / 0.6),
        ),
        estimate = linePosition(responses)!,
        error = estimate - 2;
      return (
        <>
          <Stage n={0}>
            <P d={`M${110 + 38 * pos} 65V290`} strokeWidth={8} opacity=".3" />
            <rect x={83} y={130} width={204} height={90} rx={15} />
            <rect x={385} y={125} width={150} height={65} />
          </Stage>
          <Stage n={1}>
            {responses.map((r, i) => (
              <rect
                key={i}
                x={100 + i * 38}
                y={153}
                width={21}
                height={35}
                fill="currentColor"
                fillOpacity={0.1 + r * 0.8}
              />
            ))}
            <Arrow x={290} y={160} dx={88} dy={0} />
            <P d="M460 195V265H190V225" strokeDasharray="5 6" />
            <Arrow x={185} y={118} dx={error * 38} dy={-60} />
          </Stage>
          <Stage n={2}>
            <L x={405} y={164}>
              controller
            </L>
            <L x={85} y={325}>
              offset = {error.toFixed(2)} sensors
            </L>
            <L x={340} y={300}>
              steering correction
            </L>
          </Stage>
        </>
      );
    }
    case "math-olympiad": {
      const a = { x: 155, y: 265 },
        b = { x: 445, y: 265 },
        c = { x: 245 + t * 100, y: 70 },
        o = circumcircle(a, b, c)!;
      return (
        <>
          <Stage n={0}>
            <P d={`M${a.x} ${a.y}L${b.x} ${b.y}L${c.x} ${c.y}Z`} />
          </Stage>
          <Stage n={1}>
            <circle cx={o.x} cy={o.y} r={o.r} />
            {[
              [a, b],
              [b, c],
              [c, a],
            ].map(([p, q], i) => {
              const x = (p.x + q.x) / 2,
                y = (p.y + q.y) / 2;
              return (
                <P
                  key={i}
                  d={`M${x + (x - o.x) * 0.35} ${y + (y - o.y) * 0.35}L${o.x + (o.x - x) * 0.6} ${o.y + (o.y - y) * 0.6}`}
                  strokeDasharray="4 6"
                  opacity=".6"
                />
              );
            })}
          </Stage>
          <Stage n={2}>
            {[a, b, c].map((p, i) => (
              <P key={i} d={`M${p.x} ${p.y}L${o.x} ${o.y}`} opacity=".4" />
            ))}
            <circle cx={o.x} cy={o.y} r={4} />
            <L x={o.x + 10} y={o.y + 3}>
              O
            </L>
            <L x={140} y={290}>
              A
            </L>
            <L x={450} y={290}>
              B
            </L>
            <L x={c.x + 10} y={65}>
              C
            </L>
            <L x={220} y={340}>
              OA = OB = OC
            </L>
          </Stage>
        </>
      );
    }
    case "physics-olympiad": {
      const u = 130 + t * 100,
        image = lensImage(u),
        x = 300 - u,
        ix = 300 + image.v,
        iy = 180 - image.height;
      return (
        <>
          <Stage n={0}>
            <P
              d="M40 180H560M300 60Q325 180 300 300Q275 180 300 60ZM230 175V185M370 175V185"
              opacity=".55"
            />
          </Stage>
          <Stage n={1}>
            <Arrow x={x} y={180} dx={0} dy={-65} />
            <P d={`M${x} 115H300L${ix} ${iy}M${x} 115L${ix} ${iy}`} />
            <Arrow x={ix} y={180} dx={0} dy={-image.height} />
          </Stage>
          <Stage n={2}>
            <L x={220} y={209}>
              F
            </L>
            <L x={365} y={209}>
              F
            </L>
            <L x={x - 10} y={95}>
              object
            </L>
            <L x={ix - 20} y={iy + 30}>
              image
            </L>
            <L x={140} y={335}>
              u = {u.toFixed(0)} · v = {image.v.toFixed(1)}
            </L>
          </Stage>
        </>
      );
    }
    case "bio-chem-olympiad": {
      const energy = (s: number, h: number) =>
        240 + s * 25 - Math.sin(Math.PI * s) * h;
      const curve = (h: number) =>
        Array.from(
          { length: 60 },
          (_, i) =>
            `${i ? "L" : "M"}${85 + (i / 59) * 450} ${energy(i / 59, h)}`,
        ).join(" ");
      return (
        <>
          <Stage n={0}>
            <P d="M65 290V50M65 290H555" />
            <L x={75} y={45}>
              Energy
            </L>
          </Stage>
          <Stage n={1}>
            <P d={curve(170)} strokeDasharray="5 6" opacity=".5" />
            <P d={curve(90)} strokeWidth={2} />
            <circle
              cx={85 + t * 450}
              cy={energy(t, 90)}
              r={7}
              fill="var(--accent)"
            />
          </Stage>
          <Stage n={2}>
            <L x={290} y={65}>
              without enzyme
            </L>
            <L x={315} y={174}>
              catalysed
            </L>
            <L x={85} y={325}>
              E + S ⇌ ES → E + P
            </L>
            <L x={410} y={325}>
              progress →
            </L>
          </Stage>
        </>
      );
    }
    case "programming-contest": {
      const nodes = [
          [75, 180],
          [220, 70],
          [220, 285],
          [380, 80],
          [380, 275],
          [530, 180],
        ],
        result = shortestPath(),
        step = Math.round(t * 5),
        settled = result.order.slice(0, step + 1);
      return (
        <>
          <Stage n={0}>
            {graphEdges.map(([a, b, w]) => (
              <g key={`${a}-${b}`}>
                <P d={`M${nodes[a]}L${nodes[b]}`} opacity=".4" />
                <L
                  x={(nodes[a][0] + nodes[b][0]) / 2 + 7}
                  y={(nodes[a][1] + nodes[b][1]) / 2 - 7}
                >
                  {w}
                </L>
              </g>
            ))}
          </Stage>
          <Stage n={1}>
            {step === 5 && (
              <polyline
                points={result.path.map((i) => nodes[i].join(",")).join(" ")}
                strokeWidth={4}
              />
            )}
          </Stage>
          <Stage n={2}>
            {nodes.map(([x, y], i) => (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={21}
                  fill="var(--bg)"
                  strokeWidth={settled.includes(i) ? 3 : 1}
                />
                <L x={x - 6} y={y + 6}>
                  {String.fromCharCode(65 + i)}
                </L>
                {settled.includes(i) && (
                  <L x={x - 9} y={y + 44}>
                    {result.distance[i]}
                  </L>
                )}
              </g>
            ))}
            <L x={165} y={345}>
              {step === 5
                ? "A → C → E → F · cost 8"
                : "Settled distances appear below nodes"}
            </L>
          </Stage>
        </>
      );
    }
    case "wall-magazine":
      return (
        <>
          <Stage n={0}>
            <rect x={65} y={40} width={470} height={275} />
            <P d="M85 100H515M320 120V293" opacity=".4" />
            <L x={86} y={77}>
              THE SCIENCE OF A QUESTION
            </L>
          </Stage>
          <Stage n={1}>
            <g opacity={t < 0.5 ? 1 : 0.45}>
              <P d="M105 248V125M105 248H295M115 230L280 138" />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <circle key={i} cx={115 + 33 * i} cy={230 - i * 18.4} r={4} />
              ))}
              <L x={111} y={132}>
                T²
              </L>
              <L x={275} y={270}>
                L
              </L>
            </g>
            <g opacity={t >= 0.5 ? 1 : 0.45}>
              <L x={343} y={146}>
                Longer pendulum,
              </L>
              <L x={343} y={175}>
                longer period.
              </L>
              <P d="M343 204H503M343 221H489M343 238H499M343 267H462" />
            </g>
          </Stage>
          <Stage n={2}>
            <L x={95} y={298}>
              Ideal model · T² ∝ L
            </L>
          </Stage>
        </>
      );
    case "scientific-art": {
      const sep = 40 + t * 90;
      return (
        <>
          <Stage n={0}>
            <rect x={60} y={45} width={480} height={260} opacity=".3" />
          </Stage>
          <Stage n={1}>
            {Array.from({ length: 364 }, (_, i) => {
              const x = 65 + (i % 28) * 17.4,
                y = 55 + Math.floor(i / 28) * 19;
              const difference =
                Math.hypot(x - 300 + sep, y - 175) -
                Math.hypot(x - 300 - sep, y - 175);
              const intensity = (1 + Math.cos(difference / 12)) / 2;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={1 + intensity * 2.1}
                  fill="currentColor"
                  stroke="none"
                  opacity={0.12 + 0.88 * intensity}
                />
              );
            })}
          </Stage>
          <Stage n={2}>
            <circle cx={300 - sep} cy={175} r={7} />
            <circle cx={300 + sep} cy={175} r={7} />
            <L x={175} y={340}>
              Bright: reinforcing waves
            </L>
          </Stage>
        </>
      );
    }
    case "treasure-hunt": {
      const x = 240 + 110 * t,
        y = 100 + 45 * t,
        a = (Math.atan2(x - 110, 280 - y) * 180) / Math.PI,
        b = (360 + (Math.atan2(x - 490, 280 - y) * 180) / Math.PI) % 360;
      return (
        <>
          <Stage n={0}>
            <P
              d="M70 280H530M110 280V55M490 280V55"
              opacity=".35"
              strokeDasharray="5 6"
            />
            <L x={98} y={45}>
              N
            </L>
            <L x={480} y={45}>
              N
            </L>
          </Stage>
          <Stage n={1}>
            <P d={`M110 280L${x} ${y}L490 280`} />
            <circle cx={x} cy={y} r={7} />
          </Stage>
          <Stage n={2}>
            <L x={x + 15} y={y}>
              target
            </L>
            <L x={72} y={325}>
              A · {a.toFixed(1)}°
            </L>
            <L x={407} y={325}>
              B · {b.toFixed(1)}°
            </L>
          </Stage>
        </>
      );
    }
    case "speed-cubing": {
      const turns = Math.round(t * 3),
        original = [1, 2, 3, 4, 5, 6, 7, 8, 9],
        changed = frontFaceTurn(original, turns);
      return (
        <>
          <Stage n={0}>
            <L x={80} y={65}>
              Before
            </L>
            <L x={360} y={65}>
              After {turns} quarter-turn{turns === 1 ? "" : "s"}
            </L>
          </Stage>
          <Stage n={1}>
            {[original, changed].map((face, k) => (
              <g key={k}>
                {face.map((value, i) => (
                  <g key={i}>
                    <rect
                      x={80 + k * 280 + (i % 3) * 49}
                      y={96 + Math.floor(i / 3) * 49}
                      width={47}
                      height={47}
                      fill="currentColor"
                      fillOpacity={value === 5 ? 0.2 : 0}
                    />
                    <L
                      x={98 + k * 280 + (i % 3) * 49}
                      y={126 + Math.floor(i / 3) * 49}
                    >
                      {value}
                    </L>
                  </g>
                ))}
              </g>
            ))}
            <Arrow x={260} y={170} dx={65} dy={0} />
          </Stage>
          <Stage n={2}>
            <L x={136} y={300}>
              Centre fixed · perimeter permuted
            </L>
            <L x={146} y={330}>
              Front face only; strips omitted
            </L>
          </Stage>
        </>
      );
    }
    case "bridge-building": {
      const load = 10 + Math.round(t * 90),
        m = triangleTruss(load);
      return (
        <>
          <Stage n={0}>
            <P d="M100 270L300 100L500 270ZM100 276L85 296H115ZM500 276L485 296H515Z" />
            <circle cx={490} cy={303} r={5} />
            <circle cx={510} cy={303} r={5} />
          </Stage>
          <Stage n={1}>
            <P
              d="M100 270L300 100L500 270"
              strokeWidth={3}
              strokeDasharray="7 4"
            />
            <P d="M100 270H500" strokeWidth={3} />
            <Arrow x={300} y={35} dx={0} dy={55} />
            <Arrow x={100} y={335} dx={0} dy={-30} />
            <Arrow x={500} y={335} dx={0} dy={-30} />
          </Stage>
          <Stage n={2}>
            <L x={318} y={55}>
              {load} kN
            </L>
            <L x={66} y={180}>
              C = {m.strut.toFixed(1)}
            </L>
            <L x={414} y={180}>
              C = {m.strut.toFixed(1)}
            </L>
            <L x={220} y={253}>
              T = {m.tie.toFixed(1)} kN
            </L>
            <L x={121} y={330}>
              {m.reaction} kN
            </L>
            <L x={410} y={330}>
              {m.reaction} kN
            </L>
          </Stage>
        </>
      );
    }
    case "fifa-tournament": {
      const x = 200 + 170 * t,
        blocked =
          Math.abs((x - 130) * -60 - -30 * 230) / Math.hypot(230, 60) < 17;
      return (
        <>
          <Stage n={0}>
            <rect x={60} y={45} width={480} height={270} />
            <P d="M300 45V315" opacity=".3" />
            <circle cx={300} cy={180} r={50} opacity=".3" />
          </Stage>
          <Stage n={1}>
            <P
              d="M130 240L360 180"
              strokeDasharray={blocked ? "5 6" : undefined}
              opacity={blocked ? 0.3 : 1}
            />
            <P d="M130 240L400 90L360 180" strokeWidth={2} />
            {[
              [130, 240],
              [360, 180],
              [400, 90],
            ].map(([px, py]) => (
              <circle key={px} cx={px} cy={py} r={11} fill="var(--bg)" />
            ))}
            <circle cx={x} cy={210} r={17} fill="var(--glass-reading)" />
            <P d={`M${x - 6} 204l12 12m-12 0 12-12`} />
          </Stage>
          <Stage n={2}>
            <L x={126} y={343}>
              {blocked
                ? "Direct lane blocked · use the triangle"
                : "Direct lane open · compare alternatives"}
            </L>
          </Stage>
        </>
      );
    }
    case "clash-royale-tournament": {
      const x = t < 0.5 ? 190 : 410;
      return (
        <>
          <Stage n={0}>
            <rect x={85} y={45} width={430} height={270} />
            <P d="M85 165H160M220 165H380M440 165H515M85 190H160M220 190H380M440 190H515M160 157V198M220 157V198M380 157V198M440 157V198" />
            <rect x={160} y={165} width={60} height={25} opacity=".4" />
            <rect x={380} y={165} width={60} height={25} opacity=".4" />
            {[170, 410].map((px) => (
              <g key={px}>
                <rect x={px} y={75} width={25} height={30} />
                <rect x={px} y={255} width={25} height={30} />
              </g>
            ))}
          </Stage>
          <Stage n={1}>
            <P d={`M300 290L${x} 225V120`} strokeWidth={3} />
            <Arrow x={x} y={140} dx={0} dy={-25} />
          </Stage>
          <Stage n={2}>
            <L x={185} y={343}>
              {x === 190 ? "Left bridge selected" : "Right bridge selected"}
            </L>
          </Stage>
        </>
      );
    }
    case "pubg-tournament": {
      const x = 235 + 110 * t;
      return (
        <>
          <Stage n={0}>
            <circle cx={300} cy={175} r={150} />
            <rect
              x={238}
              y={175}
              width={60}
              height={65}
              fill="currentColor"
              fillOpacity={0.15}
            />
          </Stage>
          <Stage n={1}>
            <circle cx={x} cy={135} r={56} />
            <P d={`M180 260L195 150L${x} 135`} strokeWidth={2} />
            <P d={`M180 260L320 260L335 155L${x} 135`} strokeDasharray="5 6" />
            <circle cx={180} cy={260} r={6} />
          </Stage>
          <Stage n={2}>
            <L x={x - 36} y={110}>
              next zone
            </L>
            <L x={245} y={212}>
              cover
            </L>
            <L x={155} y={350}>
              Compare two routes around cover
            </L>
          </Stage>
        </>
      );
    }
    case "valorant-tournament": {
      const origin = { x: 120, y: 90 + t * 160 };
      return (
        <>
          <Stage n={0}>
            <rect x={55} y={40} width={505} height={280} />
          </Stage>
          <Stage n={1}>
            {Array.from({ length: 15 }, (_, i) => {
              const hit = rayWall(
                origin,
                ((-40 + (i * 80) / 14) * Math.PI) / 180,
              );
              return (
                <P
                  key={i}
                  d={`M${origin.x} ${origin.y}L${hit.x} ${hit.y}`}
                  opacity=".45"
                />
              );
            })}
            <P d="M300 100V260" strokeWidth={9} />
          </Stage>
          <Stage n={2}>
            <circle cx={origin.x} cy={origin.y} r={8} fill="var(--accent)" />
            <L x={318} y={180}>
              wall
            </L>
            <L x={130} y={347}>
              Blocked rays stop at the wall
            </L>
          </Stage>
        </>
      );
    }
    default:
      return null;
  }
}
function modelResult(kind: string, t: number) {
  if (kind === "project-display")
    return `Period ${pendulumPeriod(0.4 + t).toFixed(2)} s · T² is proportional to length.`;
  if (kind === "robot-race") {
    const d = (t - 0.5) * 1.2,
      m = drive(1 - d, 1 + d);
    return `Left ${(1 - d).toFixed(2)} m/s · Right ${(1 + d).toFixed(2)} m/s · ${Number.isFinite(m.radius) ? `Turn radius ${Math.abs(m.radius).toFixed(2)} m` : "Straight trajectory"}`;
  }
  if (kind === "line-follower") {
    const p = linePosition(
      Array.from({ length: 5 }, (_, i) => Math.exp(-((i - t * 4) ** 2) / 0.6)),
    )!;
    return `Estimated offset ${(p - 2).toFixed(2)} sensor spacings from centre.`;
  }
  if (kind === "math-olympiad") {
    const c = circumcircle(
      { x: 155, y: 265 },
      { x: 445, y: 265 },
      { x: 245 + t * 100, y: 70 },
    )!;
    return `All three radii equal ${c.r.toFixed(1)} diagram units.`;
  }
  if (kind === "physics-olympiad") {
    const m = lensImage(130 + t * 100);
    return `Image distance ${m.v.toFixed(1)} units · Inverted image height ${Math.abs(m.height).toFixed(1)} units.`;
  }
  if (kind === "programming-contest")
    return Math.round(t * 5) === 5
      ? "Shortest route A → C → E → F · Total cost 8."
      : `${Math.round(t * 5) + 1} nodes settled · Shortest-path calculation in progress.`;
  if (kind === "bridge-building") {
    const m = triangleTruss(10 + Math.round(t * 90));
    return `Each support ${m.reaction} kN · Tie tension ${m.tie.toFixed(1)} kN · Each strut compression ${m.strut.toFixed(1)} kN.`;
  }
  if (kind === "speed-cubing")
    return `${Math.round(t * 3)} clockwise quarter-turn${Math.round(t * 3) === 1 ? "" : "s"} · Centre fixed. Four turns restore the face.`;
  if (kind === "scientific-art")
    return "Bright regions reinforce; dark regions cancel. Both sources remain coherent.";
  if (kind === "bio-chem-olympiad")
    return "E + S ⇌ ES → E + P · Lower activation energy; reactant and product energies unchanged by catalysis.";
  if (kind === "treasure-hunt") {
    const x = 240 + 110 * t,
      y = 100 + 45 * t;
    return `Bearing A ${((Math.atan2(x - 110, 280 - y) * 180) / Math.PI).toFixed(1)}° · Bearing B ${((360 + (Math.atan2(x - 490, 280 - y) * 180) / Math.PI) % 360).toFixed(1)}° clockwise from north.`;
  }
  if (kind === "clash-royale-tournament")
    return `${t < 0.5 ? "Left" : "Right"} bridge selected · Route crosses the river at the bridge.`;
  if (kind === "pubg-tournament")
    return "Both candidate routes avoid cover and finish in the next zone.";
  if (kind === "valorant-tournament")
    return "Rays meeting the wall stop at cover; other rays reach the boundary.";
  if (kind === "robot-soccer")
    return "Approach point stays behind the ball on the line to the goal centre.";
  if (kind === "wall-magazine")
    return "The labelled chart provides evidence; the caption explains its relationship.";
  return "The defender blocks the direct lane; the passing triangle offers an alternative.";
}
const fixedStates: Record<string, number> = {
  "robot-race": 0.75,
  "line-follower": 0.7,
  "programming-contest": 1,
  "speed-cubing": 1 / 3,
  "bridge-building": 4 / 9,
  "fifa-tournament": 0.5,
};
const prepareFigure = (svg: SVGSVGElement) => {
  const effects: Animation[] = [];
  const dense = Array.from(svg.querySelectorAll("[data-stage]")).filter(
    (group) => group.querySelectorAll("circle").length > 100,
  );
  dense.forEach((group) =>
    effects.push(
      group.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 900,
        delay: 300,
        fill: "both",
      }),
    ),
  );
  svg
    .querySelectorAll<SVGGeometryElement>(
      "[data-stage] path, [data-stage] polyline, [data-stage] line, [data-stage] rect, [data-stage] circle, [data-stage] ellipse",
    )
    .forEach((node) => {
      if (dense.some((group) => group.contains(node))) return;
      const stage = Number(
        node.closest("[data-stage]")?.getAttribute("data-stage") || 0,
      );
      const options = {
        duration: stage === 0 ? 600 : 850,
        delay: stage * 300,
        fill: "both" as FillMode,
        easing: "cubic-bezier(.4,0,.2,1)",
      };
      if (
        stage === 0 ||
        node.getAttribute("stroke") === "none" ||
        node.getAttribute("stroke-dasharray") ||
        node.closest("[stroke-dasharray]")
      ) {
        effects.push(node.animate([{ opacity: 0 }, { opacity: 1 }], options));
      } else {
        const length = node.getTotalLength();
        effects.push(
          node.animate(
            [
              {
                strokeDasharray: String(length),
                strokeDashoffset: length,
                opacity: 0,
              },
              {
                strokeDasharray: String(length),
                strokeDashoffset: 0,
                opacity: 1,
              },
            ],
            options,
          ),
        );
      }
    });
  svg.querySelectorAll("text").forEach((node) =>
    effects.push(
      node.animate(
        [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 350, delay: 1150, fill: "both" },
      ),
    ),
  );
  return effects;
};
export function ScienceFigure({
  kind = "project-display",
  className = "",
  interactive = false,
}: {
  kind?: string;
  className?: string;
  interactive?: boolean;
}) {
  const resolved =
    kind === "demo-project"
      ? "project-display"
      : kind === "demo-math"
        ? "math-olympiad"
        : kind;
  return (
    <FixedFigure
      key={resolved}
      kind={resolved}
      className={className}
      explain={interactive}
    />
  );
}
function FixedFigure({
  kind,
  className,
  explain,
}: {
  kind: string;
  className: string;
  explain: boolean;
}) {
  const details = descriptions[kind],
    id = useId(),
    ref = useRef<SVGSVGElement>(null);
  useReveal(ref, prepareFigure, 0.25);
  if (!details)
    return (
      <div className="science-figure">
        <p>A concept illustration for this event is being prepared.</p>
      </div>
    );
  const t = fixedStates[kind] ?? 0.5;
  return (
    <div className={`science-figure ${className}`}>
      <svg
        ref={ref}
        data-reveal="pending"
        viewBox="0 0 600 360"
        fill="none"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>{details[0]}</title>
        <desc id={`${id}-desc`}>{details[1]}</desc>
        <g
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Drawing kind={kind} t={t} />
        </g>
      </svg>
      <div className="figure-caption">
        <span>{details[0]}</span>
        <span>Concept illustration</span>
      </div>
      {explain && (
        <>
          <p className="diagram-readout">{modelResult(kind, t)}</p>
          <details className="figure-explanation">
            <summary>
              Read the diagram <span aria-hidden="true">+</span>
            </summary>
            <p className="diagram-explanation">{details[1]}</p>
          </details>
        </>
      )}
    </div>
  );
}
