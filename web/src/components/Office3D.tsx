"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Cat, Castle, House, NatureTree, Piece, preloadOffice } from "./OfficeModels";
import { AgentCard, Composer, Toast } from "./Island";
import { DOOR, META, ORDER, STATE_COLOR, firstLines, type Agent, type Handoff, type MapEmployee, type Worker } from "./island-meta";

export type { MapEmployee };
type Mode = "idle" | "work" | "walk";

const C = {
  ground: "#ffbfd6",
  groundSide: "#ef8fb3",
  path: "#fffafc",
  rail: "#e8699a",
  sleeper: "#ffd6e4",
  castle: "#ffb3cc",
  castleDark: "#f58fb4",
  door: "#8a3b5e",
  roofs: ["#ff6fa3", "#a98bff", "#ffb06b", "#ff8fb8", "#6fcfae"],
  house: "#fffafc",
  trunk: "#c98a62",
  leaves: ["#ff9cc3", "#9fdcc0", "#c9b3ff", "#ffc2d9"],
  cloud: "#fffafc",
  ink: "#7a2b4c",
  gold: "#f6c454",
};


const RING = 6.4;
const STOP_R = 5.2;
const HOUSE_R = 8.1;
const ANGLE: Record<Exclude<Agent, "lead">, number> = { research: Math.PI * 1.25, writer: Math.PI * 1.75, qa: Math.PI * 0.75, metrics: Math.PI * 0.25 };

function onRing(agent: Exclude<Agent, "lead">, r = RING): [number, number, number] {
  const a = ANGLE[agent];
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

function firstLine(text: string | null): string {
  if (!text) return "";
  const t = text.replace(/^\s*(1[.)]|Done:|Đã làm:)\s*/i, "").replace(/[*_`#]/g, "");
  return t.split(/\n/)[0].slice(0, 72);
}

function bubbleText(e: MapEmployee, waiting: number, week: string): string {
  if (e.agent === "lead") {
    if (e.state === "working") return "Đang điều phối đội…";
    return waiting > 0 ? `${waiting} bài chờ sếp duyệt` : `Giữ cổng duyệt tuần ${week}`;
  }
  if (e.state === "working") return "Đang làm: " + (firstLine(e.task) || META[e.agent].demoTask);
  if (e.state === "done") return firstLine(e.report) || "Xong rồi sếp!";
  return "Uống matcha, chờ việc";
}

/* ---------- small pieces ---------- */

const Mat = ({ color, flat = true }: { color: string; flat?: boolean }) => <meshStandardMaterial color={color} roughness={0.95} metalness={0} flatShading={flat} />;

function Laptop({ open }: { open: boolean }) {
  return (
    <group position={[0, 0, 0.62]} scale={1.1}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.42, 0.04, 0.3]} />
        <Mat color="#fff" />
      </mesh>
      <mesh position={[0, 0.17, -0.14]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.42, 0.28, 0.03]} />
        <Mat color={open ? "#ffd6e6" : "#fff"} />
      </mesh>
    </group>
  );
}

function Cloud({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.x = position[0] + Math.sin(clock.getElapsedTime() * 0.15 + position[2]) * 0.6;
  });
  return (
    <group ref={ref} position={position}>
      {[
        [0, 0, 0, 0.7],
        [0.7, 0.1, 0.1, 0.5],
        [-0.65, 0.05, 0.1, 0.55],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 10, 8]} />
          <meshStandardMaterial color={C.cloud} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

type TreeKind = "tree_default" | "tree_fat" | "tree_oak" | "tree_plateau" | "tree_cone" | "tree_small";
const TREE_KINDS: TreeKind[] = ["tree_default", "tree_fat", "tree_oak", "tree_plateau", "tree_cone", "tree_small"];
// x, z, kind index, leaf palette index, scale
const TREES: [number, number, number, number, number][] = [
  [9.3, 2.6, 0, 0, 2.2], [9.8, -1.4, 1, 2, 1.9], [2.4, 9.6, 2, 1, 2.1], [-1.9, 9.9, 3, 0, 1.8], [-9.4, 2.8, 0, 3, 2.2], [-9.7, -2.3, 4, 1, 2],
  [-2.6, -9.6, 1, 0, 2.1], [2.1, -9.9, 2, 2, 1.9], [7.4, 7.2, 5, 0, 1.8], [-7.3, 7.4, 3, 1, 1.7], [7.6, -7.0, 0, 3, 1.9], [-7.5, -7.3, 1, 0, 2],
  [0.4, 10.2, 5, 2, 1.6], [10.3, 0.5, 5, 0, 1.6], [-10.2, 0.3, 2, 1, 1.6], [-0.3, -10.3, 3, 3, 1.6],
];
const FLOWERS: [number, number, string, number][] = Array.from({ length: 44 }, (_, i) => {
  const a = i * 2.399, r = 3.2 + ((i * 7919) % 72) / 10;
  return [Math.cos(a) * r, Math.sin(a) * r, ["flower_purpleA", "flower_redA", "flower_yellowA", "plant_bush", "mushroom_red"][i % 5], 2 + (i % 3) * 0.4];
});

function Ground() {
  return (
    <group>
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[11.2, 11.8, 0.8, 48]} />
        <meshStandardMaterial attach="material-0" color={C.groundSide} roughness={1} />
        <meshStandardMaterial attach="material-1" color={C.ground} roughness={1} />
        <meshStandardMaterial attach="material-2" color={C.groundSide} roughness={1} />
      </mesh>
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[9.5, 8.6, 0.9, 40]} />
        <meshStandardMaterial color="#f29ebd" roughness={1} />
      </mesh>
      {/* track ring + rails + sleepers */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[RING - 0.45, RING + 0.45, 72]} />
        <meshStandardMaterial color={C.path} roughness={1} />
      </mesh>
      {[RING - 0.18, RING + 0.18].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <torusGeometry args={[r, 0.035, 5, 96]} />
          <meshStandardMaterial color={C.rail} roughness={0.8} />
        </mesh>
      ))}
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * RING, 0.02, Math.sin(a) * RING]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.14, 0.03, 0.62]} />
            <meshStandardMaterial color={C.sleeper} roughness={1} />
          </mesh>
        );
      })}
      {/* spokes castle → stations */}
      {(Object.keys(ANGLE) as Exclude<Agent, "lead">[]).map((k) => {
        const a = ANGLE[k], inner = 3.4, outer = RING - 0.45, mid = (inner + outer) / 2;
        return (
          <mesh key={k} position={[Math.cos(a) * mid, 0.012, Math.sin(a) * mid]} rotation={[-Math.PI / 2, 0, -a]}>
            <planeGeometry args={[outer - inner, 0.7]} />
            <meshStandardMaterial color={C.path} roughness={1} />
          </mesh>
        );
      })}
      {/* plaza under the castle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[3.7, 48]} />
        <meshStandardMaterial color={C.path} roughness={1} />
      </mesh>
      {FLOWERS.map(([x, z, name, sc], i) => (
        <Piece key={i} kit="nature" name={name} position={[x, 0.1, z]} rotation={[0, i * 1.7, 0]} scale={sc} recolor={{ leafsGreen: "#9fdcc0", leafsDark: "#7fcfae" }} />
      ))}
      {TREES.map(([x, z, k, leaf, sc], i) => (
        <NatureTree key={i} kind={TREE_KINDS[k]} leaf={leaf} position={[x, 0.1, z]} rotation={[0, i * 0.9, 0]} scale={sc} />
      ))}
      <Piece kit="town" name="tree-high-round" position={[5.2, 0, -8.3]} scale={1.3} />
      <Piece kit="town" name="tree" position={[-5.4, 0, -8.1]} scale={1.3} />
      <Piece kit="town" name="tree-high-round" position={[8.6, 0, 5.2]} scale={1.1} />
      <Piece kit="town" name="fountain-round-detail" position={[0, 0.02, -4.6]} scale={1.3} />
      <Piece kit="holiday" name="present-a-round" position={[4.3, 0, 0.6]} scale={1.8} />
      <Piece kit="holiday" name="present-b-cube" position={[4.4, 0, -0.5]} rotation={[0, 0.6, 0]} scale={1.8} />
      <Piece kit="holiday" name="present-b-cube" position={[-4.4, 0, 0.3]} rotation={[0, -0.4, 0]} scale={2} />
      <Piece kit="food" name="lollypop" position={[-4.2, 0, -1.1]} rotation={[0, 0.8, 0]} scale={3.2} />
      <Piece kit="food" name="frappe" position={[3.1, 0, 3.6]} scale={2} />
      <Piece kit="food" name="cup-tea" position={[-3.2, 0, 3.7]} rotation={[0, 2.2, 0]} scale={2.4} />
      <Piece kit="holiday" name="candy-cane-red" position={[2.2, 0, 4.4]} rotation={[0, -0.5, 0]} scale={2.6} />
      <Piece kit="holiday" name="candy-cane-red" position={[-2.3, 0, 4.5]} rotation={[0, 0.9, 0]} scale={2.6} />
      <Cloud position={[-6, 6.5, -4]} />
      <Cloud position={[5, 7.2, -6]} />
      <Cloud position={[7, 6, 4]} />
    </group>
  );
}

/* ---------- screen overlay (DOM, projected each frame) ---------- */

type Anchor = { id: string; pos: [number, number, number] };
type Nodes = Map<string, HTMLElement>;
const tmp = new THREE.Vector3();

function Projector({ anchors, nodes, leadPos }: { anchors: Anchor[]; nodes: Nodes; leadPos: React.RefObject<[number, number, number]> }) {
  const { camera, size } = useThree();
  useFrame(() => {
    for (const a of anchors) {
      const el = nodes.get(a.id);
      if (!el) continue;
      const p = a.id === "b:lead" ? leadPos.current : a.pos;
      tmp.set(p[0], p[1], p[2]);
      const dist = camera.position.distanceTo(tmp);
      tmp.project(camera);
      const x = ((tmp.x + 1) / 2) * size.width, y = ((1 - tmp.y) / 2) * size.height;
      const sc = Math.min(1, Math.max(0.55, 20 / dist));
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${a.id.startsWith("n:") && a.id !== "n:lead" ? "6%" : "-100%"}) scale(${sc})`;
      el.style.opacity = tmp.z < 1 ? "1" : "0";
    }
  });
  return null;
}

function FitCamera() {
  useFrame(({ camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const fov = aspect < 0.9 ? 50 : aspect < 1.3 ? 40 : 32;
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

function Bubble({ text, working, dark, wide, action }: { text: string; working: boolean; dark?: boolean; wide?: boolean; action?: { label: string; onClick: () => void } }) {
  const border = dark ? C.ink : working ? "#f59e0b" : "#ffd0e0";
  return (
    <div className={`relative ${wide ? "max-w-[260px]" : "max-w-[170px]"} rounded-2xl px-2.5 py-1 text-[11.5px] leading-snug shadow-sm`} style={{ background: dark ? C.ink : "#fff", color: dark ? "#fff" : C.ink, border: `1.5px solid ${border}`, width: "max-content" }}>
      {text}
      {action && (
        <button type="button" onClick={action.onClick} className="pointer-events-auto ml-1 font-semibold text-[#ffc9dc]">
          {action.label}
        </button>
      )}
      <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `7px solid ${border}` }} />
    </div>
  );
}

function NamePill({ name, state, selected, onClick }: { name: string; state: MapEmployee["state"]; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="pointer-events-auto flex items-center gap-1.5 rounded-full border bg-white/95 px-2.5 py-1 text-[12px] font-semibold shadow-sm" style={{ color: C.ink, borderColor: selected ? "#f59e0b" : "#ffd0e0", whiteSpace: "nowrap" }}>
      <span className={`inline-block h-2 w-2 rounded-full ${state === "working" ? "animate-pulse" : ""}`} style={{ background: STATE_COLOR[state] }} />
      {name}
    </button>
  );
}

/* ---------- handoff playback ---------- */

// The lead acts out the team's real handoffs: walks to the worker, hands over the task (or collects the report),
// walks back. "replay" plays a finished run from the start; "live" plays each handoff as it lands while the team works.
const STEP = { out: 2.2, pause: 2.4, back: 2.2 } as const;
const STEP_TOTAL = STEP.out + STEP.pause + STEP.back;
type Step = { agent: Worker; kind: "task" | "report"; text: string };
type Overrides = Partial<Record<Worker, MapEmployee["state"]>>;
type View = { leadPos: [number, number, number]; leadRot: number; leadMode: Mode | null; states: Overrides; leadLine: string | null; workerLine: { agent: Worker; text: string } | null };
type Player = { mode: "replay" | "live" | null; steps: Step[]; idx: number; startAt: number; states: Overrides };

const ease = (p: number) => p * p * (3 - 2 * p);
const toSteps = (hs: Handoff[]): Step[] => hs.flatMap((h) => (ORDER.includes(h.agent as Worker) ? [{ agent: h.agent as Worker, kind: h.kind, text: h.text }] : []));
const afterStep = (states: Overrides, s: Step): Overrides => ({ ...states, [s.agent]: s.kind === "task" ? "working" : "done" });
const viewKey = (v: View) => JSON.stringify([v.leadMode, v.leadLine, v.workerLine, v.states]);

// The lead leaves from the castle edge nearest the worker, so it never walks through the castle.
function stepView(s: Step, local: number, states: Overrides): View {
  const name = META[s.agent].name;
  const [sx, , sz] = onRing(s.agent, STOP_R - 1.5);
  const edge: [number, number, number] = [Math.cos(ANGLE[s.agent]) * 3.4, 0, Math.sin(ANGLE[s.agent]) * 3.4];
  const line = s.kind === "task" ? `${name} ơi: ${firstLines(s.text, 1, 60) || "lấy việc đi"}` : `${name} xong chưa?`;
  const report = s.kind === "report" ? { agent: s.agent, text: firstLines(s.text, 1, 72) || "Xong rồi sếp!" } : null;
  if (local < STEP.out) {
    const p = ease(local / STEP.out);
    return { leadPos: [edge[0] + (sx - edge[0]) * p, 0, edge[2] + (sz - edge[2]) * p], leadRot: Math.atan2(sx - edge[0], sz - edge[2]), leadMode: "walk", states, leadLine: line, workerLine: null };
  }
  const after = afterStep(states, s);
  if (local < STEP.out + STEP.pause) return { leadPos: [sx, 0, sz], leadRot: Math.atan2(sx, sz), leadMode: "idle", states: after, leadLine: s.kind === "task" ? line : `Nhận bài của ${name}`, workerLine: report };
  const p = ease((local - STEP.out - STEP.pause) / STEP.back);
  return { leadPos: [sx + (edge[0] - sx) * p, 0, sz + (edge[2] - sz) * p], leadRot: Math.atan2(edge[0] - sx, edge[2] - sz), leadMode: "walk", states: after, leadLine: null, workerLine: report };
}

/* ---------- scene ---------- */

const STOP = Object.fromEntries(ORDER.map((a) => [a, onRing(a, STOP_R)])) as Record<Exclude<Agent, "lead">, [number, number, number]>;
const LEAD_HOME: [number, number, number] = [0, 0, 3.6];
const CAT_SCALE = 1.6; // world height of a cat
const PROPS: Record<Exclude<Agent, "lead">, string> = { research: "cupcake", writer: "ice-cream", qa: "donut-sprinkles", metrics: "cake-birthday" };

function Train() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = -clock.getElapsedTime() * 0.22;
  });
  const cars: [string, number][] = [
    ["train-locomotive", 0],
    ["train-tender", -0.19],
    ["train-wagon", -0.38],
  ];
  return (
    <group ref={ref}>
      {cars.map(([name, th]) => (
        <Piece key={name} kit="holiday" name={name} position={[Math.cos(th) * RING, 0.05, Math.sin(th) * RING]} rotation={[0, -th - Math.PI / 2, 0]} scale={2.2} />
      ))}
    </group>
  );
}

function Scene({ team, playerRef, view, setView, autoRotate, sel, setSel, onOpen, setHover, resetKey, nodes, anchors }: {
  team: MapEmployee[]; playerRef: React.RefObject<Player>; view: View | null; setView: (v: View | null) => void; autoRotate: boolean; sel: Agent; setSel: (a: Agent) => void; onOpen: (a: Agent) => void; setHover: (a: Agent | null) => void; resetKey: number; nodes: Nodes; anchors: Anchor[];
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  // A building is a door to a page; a cat opens its card.
  const door = (a: Agent) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setHover(null); document.body.style.cursor = ""; onOpen(a); },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(a); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { setHover(null); document.body.style.cursor = ""; },
  });
  const pick = (a: Agent) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSel(a); },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { document.body.style.cursor = ""; },
  });
  const leadRef = useRef<THREE.Group>(null);
  const leadPos = useRef<[number, number, number]>([LEAD_HOME[0], 2.1, LEAD_HOME[2]]);

  useEffect(() => {
    controls.current?.reset();
  }, [resetKey]);

  // Advances the playback each frame; React state changes only when a bubble or a worker's state changes.
  useFrame(({ clock }) => {
    const place = (pos: [number, number, number], rot: number) => {
      if (leadRef.current) {
        leadRef.current.position.set(...pos);
        leadRef.current.rotation.y = rot;
      }
      leadPos.current = [pos[0], 2.1, pos[2]];
    };
    const s = playerRef.current.mode ? playerRef.current.steps[playerRef.current.idx] : undefined;
    if (!s) {
      playerRef.current.mode = null;
      place(LEAD_HOME, 0);
      if (view) setView(null);
      return;
    }
    const now = clock.getElapsedTime();
    if (!playerRef.current.startAt) playerRef.current.startAt = now;
    const local = now - playerRef.current.startAt;
    if (local >= STEP_TOTAL) {
      playerRef.current.states = afterStep(playerRef.current.states, s);
      playerRef.current.idx += 1;
      playerRef.current.startAt = 0;
      return;
    }
    const v = stepView(s, local, playerRef.current.states);
    place(v.leadPos, v.leadRot);
    if (!view || viewKey(view) !== viewKey(v)) setView(v);
  });

  const byAgent = Object.fromEntries(team.map((t) => [t.agent, t])) as Record<Agent, MapEmployee>;
  const leadMode: Mode = view?.leadMode ?? (byAgent.lead.state === "working" ? "work" : "idle");

  return (
    <>
      <PerspectiveCamera makeDefault position={[17, 12.5, 17]} fov={32} />
      <FitCamera />
      <OrbitControls ref={controls} makeDefault target={[0, 1.5, 0]} enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={10} maxDistance={36} minPolarAngle={0.5} maxPolarAngle={1.25} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#ffffff", "#ffd1e3", 0.55]} />
      <directionalLight position={[8, 14, 6]} intensity={2.2} />
      <directionalLight position={[-8, 6, -6]} intensity={0.5} />
      <Ground />
      <Suspense fallback={null}>
        <Train />
        <group {...door("lead")}>
          <Castle scale={0.95} />
        </group>
        <group ref={leadRef} position={LEAD_HOME} {...pick("lead")}>
          <Cat fur={META.lead.fur} anim={leadMode} faceCamera={leadMode !== "walk"} scale={CAT_SCALE}>
            <mesh position={[0, 1.01, 0.08]}>
              <cylinderGeometry args={[0.12, 0.15, 0.14, 5]} />
              <meshStandardMaterial color={C.gold} roughness={0.5} metalness={0.3} flatShading />
            </mesh>
          </Cat>
        </group>
        {ORDER.map((agent) => {
          const e = byAgent[agent];
          const state = view?.states[agent] ?? e.state;
          const a = ANGLE[agent];
          const house = onRing(agent, HOUSE_R);
          const prop: [number, number, number] = [Math.cos(a + 0.28) * (HOUSE_R - 0.6), 0, Math.sin(a + 0.28) * (HOUSE_R - 0.6)];
          const cane: [number, number, number] = [Math.cos(a - 0.26) * (HOUSE_R - 0.4), 0, Math.sin(a - 0.26) * (HOUSE_R - 0.4)];
          const lantern: [number, number, number] = [Math.cos(a - 0.12) * (RING - 0.9), 0, Math.sin(a - 0.12) * (RING - 0.9)];
          return (
            <group key={agent}>
              <group {...door(agent)}>
                <House roof={META[agent].roof} position={house} rotation={[0, Math.PI - a, 0]} scale={1.7} />
              </group>
              <Piece kit="food" name={PROPS[agent]} position={prop} rotation={[0, -a, 0]} scale={2.3} />
              <Piece kit="holiday" name="candy-cane-red" position={cane} rotation={[0, -a + 0.4, 0]} scale={2.4} />
              <Piece kit="town" name="lantern" position={lantern} scale={0.9} />
              <group position={STOP[agent]} {...pick(agent)}>
                <Cat fur={META[agent].fur} anim={state === "working" ? "work" : "idle"} faceCamera scale={CAT_SCALE}>
                  <Laptop open={state !== "waiting"} />
                </Cat>
                {sel === agent && (
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
                    <ringGeometry args={[1.0, 1.2, 40]} />
                    <meshStandardMaterial color="#f59e0b" transparent opacity={0.55} />
                  </mesh>
                )}
              </group>
            </group>
          );
        })}
      </Suspense>
      <ContactShadows position={[0, 0.02, 0]} opacity={0.32} scale={32} blur={2.4} far={9} resolution={512} color="#8a3b5e" />
      <Projector anchors={anchors} nodes={nodes} leadPos={leadPos} />
    </>
  );
}

preloadOffice();

/* ---------- page component ---------- */

const WIDE = "(min-width: 1024px)";

// compact: just the scene, filling its parent (the desktop home page). full: the whole window under the app's nav,
// with the composer, the employee card and the toast floating over the island (the Văn phòng page).
// Otherwise a boxed scene with the card beside it.
export default function Office3D({ team, handoffs = [], waiting, week, running = false, compact = false, full = false }: { team: MapEmployee[]; handoffs?: Handoff[]; waiting: number; week: string; running?: boolean; compact?: boolean; full?: boolean }) {
  const router = useRouter();
  const [sel, setSelState] = useState<Agent>(team.find((t) => t.state === "working" && t.agent !== "lead")?.agent ?? "lead");
  // The card: always there on a wide screen, a sheet you open by tapping a cat on a phone.
  const [panel, setPanel] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE).matches);
  const [targetOn, setTargetOn] = useState(false);
  const [hover, setHover] = useState<Agent | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [bubbles, setBubbles] = useState(true);
  // Playback: what the lead is acting out right now (null when standing home), driven by the player ref in the scene.
  const player = useRef<Player>({ mode: null, steps: [], idx: 0, startAt: 0, states: {} });
  const [view, setView] = useState<View | null>(null);
  const replay = () => {
    player.current = { mode: "replay", steps: toSteps(handoffs), idx: 0, startAt: 0, states: Object.fromEntries(ORDER.map((a) => [a, "waiting"])) };
  };
  const stopPlay = () => {
    player.current.mode = null;
  };
  // Handoffs that land after the page opened (each poll re-renders with the log) are acted out as they come.
  const seenAt = useRef(handoffs[handoffs.length - 1]?.at ?? "");
  useEffect(() => {
    const fresh = handoffs.filter((h) => h.at > seenAt.current);
    if (fresh.length === 0) return;
    seenAt.current = fresh[fresh.length - 1].at;
    const p = player.current;
    if (p.mode === "replay") return;
    if (p.mode === "live") p.steps = [...p.steps, ...toSteps(fresh)];
    else player.current = { mode: "live", steps: toSteps(fresh), idx: 0, startAt: 0, states: {} };
  }, [handoffs]);
  const [resetKey, setResetKey] = useState(0);
  const [toastOn, setToastOn] = useState(false);
  const [toastN, setToastN] = useState(0);
  const nodes = useMemo<Nodes>(() => new Map(), []);
  const anchors = useMemo<Anchor[]>(
    () => [
      { id: "b:lead", pos: [LEAD_HOME[0], 2.1, LEAD_HOME[2]] },
      { id: "n:lead", pos: [0, 5.4, 0] },
      { id: "h:lead", pos: [0, 7.2, 0] },
      ...ORDER.flatMap((a): Anchor[] => {
        const h = onRing(a, HOUSE_R);
        return [
          { id: `b:${a}`, pos: [STOP[a][0], 2.1, STOP[a][2]] },
          { id: `n:${a}`, pos: [STOP[a][0], -0.9, STOP[a][2]] },
          { id: `h:${a}`, pos: [h[0], 3.6, h[2]] },
        ];
      }),
    ],
    [],
  );
  const register = (id: string) => (el: HTMLElement | null) => {
    if (el) nodes.set(id, el);
    else nodes.delete(id);
  };
  // Tapping a cat opens its card; with a worker chosen, the composer addresses it.
  const setSel = (a: Agent) => {
    setSelState(a);
    setPanel(true);
    setTargetOn(a !== "lead");
  };
  const open = (a: Agent) => router.push(DOOR[a].href);

  const byAgent = Object.fromEntries(team.map((t) => [t.agent, t])) as Record<Agent, MapEmployee>;
  const stateOf = (a: Agent): MapEmployee["state"] => (a !== "lead" ? view?.states[a] : undefined) ?? byAgent[a].state;
  const leadLine = view?.leadLine ?? null;
  const lead = byAgent.lead;
  // On the island page the lead's bubble is its latest reply, and a toast says when a new one lands while you watch.
  const leadReply = full && lead.state !== "working" && !leadLine ? firstLines(lead.report) : "";
  const [seenReport, setSeenReport] = useState(lead.report);
  if (seenReport !== lead.report) {
    setSeenReport(lead.report);
    if (lead.report) {
      setToastOn(true);
      setToastN((n) => n + 1);
    }
  }
  useEffect(() => {
    if (!toastOn) return;
    const t = setTimeout(() => setToastOn(false), 9000);
    return () => clearTimeout(t);
  }, [toastOn, toastN]);
  const toast = toastOn ? "Trưởng nhóm vừa báo cáo" : null;

  const target: Worker | null = full && targetOn && sel !== "lead" ? sel : null;
  const pill = (active: boolean) => `rounded-full px-3 py-1 text-[12px] font-semibold shadow-sm transition ${active ? "bg-[#7a2b4c] text-white" : "bg-white/90 text-[#7a2b4c] hover:bg-white"}`;
  const chip = "rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-[#7a2b4c]";
  const card = (cls: string) => <AgentCard agent={sel} e={byAgent[sel]} state={stateOf(sel)} waiting={waiting} onClose={full ? () => setPanel(false) : undefined} className={cls} />;

  return (
    <div className={compact || full ? "h-full" : "grid gap-4 lg:mx-[calc(50%-min(50vw,590px))] lg:grid-cols-[1fr_300px] lg:items-start"}>
      <div
        className={`overflow-hidden ${full ? "fixed inset-x-0 top-0 bottom-[84px] z-10 lg:bottom-0 lg:left-[220px]" : `relative rounded-3xl border border-pink-200 ${compact ? "h-full min-h-[520px]" : "h-[56vh] min-h-[400px] sm:h-[64vh]"}`}`}
        style={{ background: "linear-gradient(180deg,#ffe4ef 0%,#fff3f8 55%,#ffe9f2 100%)" }}
      >
        <Canvas dpr={[1, 1.75]} gl={{ alpha: true, antialias: true, toneMapping: THREE.NoToneMapping }} className="!absolute inset-0">
          <Scene team={team} playerRef={player} view={view} setView={setView} autoRotate={autoRotate} sel={sel} setSel={setSel} onOpen={open} setHover={setHover} resetKey={resetKey} nodes={nodes} anchors={anchors} />
        </Canvas>
        {/* projected labels */}
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {(["lead", ...ORDER] as Agent[]).map((a) => {
            const st = stateOf(a);
            const shown: MapEmployee = { ...byAgent[a], state: st };
            const reply = a === "lead" ? leadReply : "";
            const said = a === "lead" ? leadLine : view?.workerLine?.agent === a ? view.workerLine.text : null;
            const text = said || reply || bubbleText(shown, waiting, week);
            return (
              <div key={a}>
                {bubbles && (
                  <div ref={register(`b:${a}`)} className="absolute left-0 top-0 will-change-transform">
                    <Bubble text={text} working={st === "working"} dark={a === "lead" && (!!leadLine || !!reply)} wide={!!reply} action={reply ? { label: "Xem đầy đủ ›", onClick: () => setSel("lead") } : undefined} />
                  </div>
                )}
                <div ref={register(`n:${a}`)} className="absolute left-0 top-0 will-change-transform">
                  <NamePill name={a === "lead" ? "Claude Code · Điều phối" : META[a].name} state={st} selected={sel === a} onClick={() => setSel(a)} />
                </div>
                <div ref={register(`h:${a}`)} className="absolute left-0 top-0 will-change-transform" style={{ visibility: hover === a ? "visible" : "hidden" }}>
                  <span className="rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-sm" style={{ whiteSpace: "nowrap" }}>{DOOR[a].label} ›</span>
                </div>
              </div>
            );
          })}
        </div>
        {/* chrome */}
        <div className="absolute inset-x-3 top-3 z-30 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[#7a2b4c] px-3 py-1 text-[12px] font-bold text-white">Đội AI</span>
          <button className={pill(!autoRotate)} onClick={() => setAutoRotate((v) => !v)}>{autoRotate ? "Dừng xoay" : "Xoay"}</button>
          <button className={pill(bubbles)} onClick={() => setBubbles((v) => !v)}>Bong bóng</button>
          <button className={pill(false)} onClick={() => setResetKey((k) => k + 1)}>Toàn cảnh</button>
          {running ? (
            <span className={`${chip} inline-flex items-center gap-1.5`}><span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-[#cf3d7a]" />Trực tiếp</span>
          ) : handoffs.length > 0 ? (
            <button className={pill(!!view)} onClick={() => (view ? stopPlay() : replay())}>{view ? "Dừng" : "Xem lại ▶"}</button>
          ) : null}
          <span className="ml-auto flex items-center gap-1.5">
            <span className={`${chip} hidden md:inline`}>5 nhân viên</span>
            <Link href="/drafts" className="rounded-full bg-[#7a2b4c] px-3 py-1 text-[12px] font-semibold text-white">Cổng duyệt · {waiting} bài</Link>
          </span>
        </div>
        {full && toast && <Toast text={toast} onOpen={() => { setToastOn(false); setSel("lead"); }} className="absolute left-1/2 top-[76px] z-30 -translate-x-1/2 lg:top-14" />}
      </div>

      {full ? (
        <>
          <Composer running={running} target={target} onClearTarget={() => setTargetOn(false)} className={`${panel ? "hidden lg:flex" : "flex"} fixed inset-x-3 bottom-[96px] z-30 lg:bottom-4 lg:left-[244px] lg:right-auto lg:w-[min(640px,calc(100vw-604px))]`} />
          {panel && card("fixed inset-x-0 bottom-[84px] z-40 max-h-[64vh] overflow-auto rounded-t-[22px] border border-line bg-[#fff7fa] p-4 pb-5 shadow-[0_-8px_30px_rgba(207,61,122,0.14)] lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-16 lg:max-h-none lg:w-[320px] lg:rounded-[18px] lg:shadow-[0_8px_30px_rgba(207,61,122,0.12)]")}
        </>
      ) : (
        !compact && card("card border-pink-200 bg-[#fff7fa] lg:max-h-[64vh] lg:overflow-auto")
      )}
    </div>
  );
}
