"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import Link from "next/link";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Cat, Castle, House, NatureTree, Piece, preloadOffice } from "./OfficeModels";

export type MapEmployee = {
  agent: "lead" | "research" | "writer" | "qa" | "metrics";
  state: "working" | "done" | "waiting";
  task: string | null;
  report: string | null;
  since: string | null;
};
type Agent = MapEmployee["agent"];
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

const META: Record<Agent, { name: string; fur: string; roof: string; tools: string; job: string; demoTask: string }> = {
  lead: { name: "Điều phối", fur: "#fff1e6", roof: C.roofs[0], tools: "Giao việc, đọc, ghi", job: "Nhận lệnh của bạn, chia việc, giữ cổng duyệt, báo cáo ba dòng", demoTask: "" },
  research: { name: "Nghiên cứu", fur: "#cdb8ff", roof: "#a98bff", tools: "Tìm web, đọc web, bash", job: "Quét đối thủ và bình luận, bảng nỗi đau, 5 chủ đề", demoTask: "quét đối thủ và bình luận tuần này" },
  writer: { name: "Viết bài", fur: "#ff9ec4", roof: "#ff6fa3", tools: "Chỉ đọc, ghi file", job: "3 đến 5 bài nháp mỗi tuần, đúng giọng thương hiệu", demoTask: "viết 4 bài nháp từ 5 chủ đề" },
  qa: { name: "QA-QC", fur: "#ffd0b0", roof: "#ffb06b", tools: "Chỉ đọc, ghi file", job: "Soát số liệu, từ cấm, giọng, độ dài; đặt trạng thái", demoTask: "soát 4 bài nháp, đặt trạng thái" },
  metrics: { name: "Đo số liệu", fur: "#fff0a8", roof: "#6fcfae", tools: "Đọc CSV, bash", job: "So sánh tuần, lặp lại / bỏ, việc cho thứ 2", demoTask: "so số liệu tuần này với tuần trước" },
};

const RING = 6.4;
const STOP_R = 5.2;
const HOUSE_R = 8.1;
const ANGLE: Record<Exclude<Agent, "lead">, number> = { research: Math.PI * 1.25, writer: Math.PI * 1.75, qa: Math.PI * 0.75, metrics: Math.PI * 0.25 };
const STATE_LABEL = { working: "Đang chạy", done: "Xong việc", waiting: "Chờ việc" } as const;
const STATE_COLOR = { working: "#f59e0b", done: "#10b981", waiting: "#c4b5c9" } as const;

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
    <group position={[0, 0, 0.75]} scale={1.1}>
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

function Bubble({ text, working, dark }: { text: string; working: boolean; dark?: boolean }) {
  const border = dark ? C.ink : working ? "#f59e0b" : "#ffd0e0";
  return (
    <div className="relative max-w-[170px] rounded-2xl px-2.5 py-1 text-[11.5px] leading-snug shadow-sm" style={{ background: dark ? C.ink : "#fff", color: dark ? "#fff" : C.ink, border: `1.5px solid ${border}`, width: "max-content" }}>
      {text}
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

/* ---------- demo timeline ---------- */

const ORDER: Exclude<Agent, "lead">[] = ["research", "writer", "qa", "metrics"];
const STEP = { out: 2.6, work: 3.2, back: 2.6 } as const;
const STEP_TOTAL = STEP.out + STEP.work + STEP.back;

type Demo = { leadPos: [number, number, number]; leadRot: number; leadMode: Mode; states: Record<Exclude<Agent, "lead">, MapEmployee["state"]>; leadLine: string | null };

function demoAt(t: number): Demo {
  const i = Math.floor(t / STEP_TOTAL) % ORDER.length;
  const local = t % STEP_TOTAL;
  const agent = ORDER[i];
  const [sx, , sz] = onRing(agent, STOP_R - 1.5);
  const start: [number, number, number] = [Math.cos(ANGLE[agent]) * 3.4, 0, Math.sin(ANGLE[agent]) * 3.4];
  const states = Object.fromEntries(ORDER.map((a, j) => [a, j < i ? "done" : "waiting"])) as Demo["states"];
  const ease = (p: number) => p * p * (3 - 2 * p);
  if (local < STEP.out) {
    const p = ease(local / STEP.out);
    return { leadPos: [start[0] + (sx - start[0]) * p, 0, start[2] + (sz - start[2]) * p], leadRot: Math.atan2(sx - start[0], sz - start[2]), leadMode: "walk", states, leadLine: `${META[agent].name} ơi, lấy task đi!` };
  }
  if (local < STEP.out + STEP.work) {
    states[agent] = "working";
    return { leadPos: [sx, 0, sz], leadRot: Math.atan2(sx, sz), leadMode: "idle", states, leadLine: `${META[agent].name} ơi, lấy task đi!` };
  }
  const p = ease((local - STEP.out - STEP.work) / STEP.back);
  states[agent] = "done";
  return { leadPos: [sx + (start[0] - sx) * p, 0, sz + (start[2] - sz) * p], leadRot: Math.atan2(start[0] - sx, start[2] - sz), leadMode: "walk", states, leadLine: null };
}

/* ---------- scene ---------- */

const STOP = Object.fromEntries(ORDER.map((a) => [a, onRing(a, STOP_R)])) as Record<Exclude<Agent, "lead">, [number, number, number]>;
const LEAD_HOME: [number, number, number] = [0, 0, 3.6];
const CAT_SCALE = 1.8; // world height of a cat
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

function Scene({ team, demo, demoView, setDemoView, autoRotate, sel, setSel, resetKey, nodes, anchors }: {
  team: MapEmployee[]; demo: boolean; demoView: Demo | null; setDemoView: (d: Demo | null) => void; autoRotate: boolean; sel: Agent; setSel: (a: Agent) => void; resetKey: number; nodes: Nodes; anchors: Anchor[];
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const leadRef = useRef<THREE.Group>(null);
  const demoStart = useRef(0);
  const leadPos = useRef<[number, number, number]>([LEAD_HOME[0], 2.1, LEAD_HOME[2]]);

  useEffect(() => {
    controls.current?.reset();
  }, [resetKey]);
  useEffect(() => {
    if (!demo) demoStart.current = 0;
  }, [demo]);

  useFrame(({ clock }) => {
    if (!demo) {
      if (demoView) setDemoView(null);
      if (leadRef.current) {
        leadRef.current.position.set(...LEAD_HOME);
        leadRef.current.rotation.y = 0;
      }
      leadPos.current = [LEAD_HOME[0], 2.1, LEAD_HOME[2]];
      return;
    }
    if (!demoStart.current) demoStart.current = clock.getElapsedTime();
    const d = demoAt(clock.getElapsedTime() - demoStart.current);
    if (leadRef.current) {
      leadRef.current.position.set(...d.leadPos);
      leadRef.current.rotation.y = d.leadRot;
    }
    leadPos.current = [d.leadPos[0], 2.1, d.leadPos[2]];
    if (!demoView || demoView.leadMode !== d.leadMode || demoView.leadLine !== d.leadLine || ORDER.some((a) => demoView.states[a] !== d.states[a])) setDemoView(d);
  });

  const byAgent = Object.fromEntries(team.map((t) => [t.agent, t])) as Record<Agent, MapEmployee>;
  const leadMode: Mode = demo && demoView ? demoView.leadMode : byAgent.lead.state === "working" ? "work" : "idle";

  return (
    <>
      <PerspectiveCamera makeDefault position={[17, 12.5, 17]} fov={32} />
      <FitCamera />
      <OrbitControls ref={controls} makeDefault target={[0, 1.9, 0]} enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={10} maxDistance={36} minPolarAngle={0.5} maxPolarAngle={1.25} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#ffffff", "#ffd1e3", 0.55]} />
      <directionalLight position={[8, 14, 6]} intensity={2.2} />
      <directionalLight position={[-8, 6, -6]} intensity={0.5} />
      <Ground />
      <Suspense fallback={null}>
        <Train />
        <group onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSel("lead"); }}>
          <Castle scale={1.3} />
          <group ref={leadRef} position={LEAD_HOME}>
            <Cat fur={META.lead.fur} anim={leadMode} faceCamera={leadMode !== "walk"} scale={CAT_SCALE}>
              <mesh position={[0, 1.0, 0.5]}>
                <cylinderGeometry args={[0.12, 0.15, 0.13, 5]} />
                <meshStandardMaterial color={C.gold} roughness={0.5} metalness={0.3} flatShading />
              </mesh>
            </Cat>
          </group>
        </group>
        {ORDER.map((agent) => {
          const e = byAgent[agent];
          const state = demo && demoView ? demoView.states[agent] : e.state;
          const a = ANGLE[agent];
          const house = onRing(agent, HOUSE_R);
          const prop: [number, number, number] = [Math.cos(a + 0.28) * (HOUSE_R - 0.6), 0, Math.sin(a + 0.28) * (HOUSE_R - 0.6)];
          const cane: [number, number, number] = [Math.cos(a - 0.26) * (HOUSE_R - 0.4), 0, Math.sin(a - 0.26) * (HOUSE_R - 0.4)];
          const lantern: [number, number, number] = [Math.cos(a - 0.12) * (RING - 0.9), 0, Math.sin(a - 0.12) * (RING - 0.9)];
          return (
            <group key={agent} onClick={(ev: ThreeEvent<MouseEvent>) => { ev.stopPropagation(); setSel(agent); }}>
              <House roof={META[agent].roof} position={house} rotation={[0, Math.PI - a, 0]} scale={1.7} />
              <Piece kit="food" name={PROPS[agent]} position={prop} rotation={[0, -a, 0]} scale={2.3} />
              <Piece kit="holiday" name="candy-cane-red" position={cane} rotation={[0, -a + 0.4, 0]} scale={2.4} />
              <Piece kit="town" name="lantern" position={lantern} scale={0.9} />
              <group position={STOP[agent]}>
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

export default function Office3D({ team, waiting, week }: { team: MapEmployee[]; waiting: number; week: string }) {
  const [sel, setSel] = useState<Agent>(team.find((t) => t.state === "working" && t.agent !== "lead")?.agent ?? "lead");
  const [autoRotate, setAutoRotate] = useState(true);
  const [bubbles, setBubbles] = useState(true);
  const [demo, setDemo] = useState(false);
  const [demoView, setDemoView] = useState<Demo | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const nodes = useMemo<Nodes>(() => new Map(), []);
  const anchors = useMemo<Anchor[]>(
    () => [
      { id: "b:lead", pos: [LEAD_HOME[0], 2.1, LEAD_HOME[2]] },
      { id: "n:lead", pos: [0, 7.2, 0] },
      ...ORDER.flatMap((a): Anchor[] => [
        { id: `b:${a}`, pos: [STOP[a][0], 2.1, STOP[a][2]] },
        { id: `n:${a}`, pos: [STOP[a][0], -0.05, STOP[a][2]] },
      ]),
    ],
    [],
  );
  const register = (id: string) => (el: HTMLElement | null) => {
    if (el) nodes.set(id, el);
    else nodes.delete(id);
  };

  const byAgent = Object.fromEntries(team.map((t) => [t.agent, t])) as Record<Agent, MapEmployee>;
  const stateOf = (a: Agent): MapEmployee["state"] => (a !== "lead" && demo && demoView ? demoView.states[a] : byAgent[a].state);
  const leadLine = demo && demoView ? demoView.leadLine : null;
  const selected = byAgent[sel];
  const m = META[sel];
  const since = selected.since ? new Date(selected.since).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  const pill = (active: boolean) => `rounded-full px-3 py-1 text-[12px] font-semibold shadow-sm transition ${active ? "bg-[#7a2b4c] text-white" : "bg-white/90 text-[#7a2b4c] hover:bg-white"}`;
  const chip = "rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-[#7a2b4c]";

  return (
    <div className="grid gap-4 lg:mx-[calc(50%-min(50vw,590px))] lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="relative h-[56vh] min-h-[400px] overflow-hidden rounded-3xl border border-pink-200 sm:h-[64vh]" style={{ background: "linear-gradient(180deg,#ffe4ef 0%,#fff3f8 55%,#ffe9f2 100%)" }}>
        <Canvas dpr={[1, 1.75]} gl={{ alpha: true, antialias: true, toneMapping: THREE.NoToneMapping }} className="!absolute inset-0">
          <Scene team={team} demo={demo} demoView={demoView} setDemoView={setDemoView} autoRotate={autoRotate} sel={sel} setSel={setSel} resetKey={resetKey} nodes={nodes} anchors={anchors} />
        </Canvas>
        {/* projected labels */}
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {(["lead", ...ORDER] as Agent[]).map((a) => {
            const st = stateOf(a);
            const shown: MapEmployee = { ...byAgent[a], state: st };
            const text = a === "lead" && leadLine ? leadLine : bubbleText(shown, waiting, week);
            return (
              <div key={a}>
                {bubbles && (
                  <div ref={register(`b:${a}`)} className="absolute left-0 top-0 will-change-transform">
                    <Bubble text={text} working={st === "working"} dark={a === "lead" && !!leadLine} />
                  </div>
                )}
                <div ref={register(`n:${a}`)} className="absolute left-0 top-0 will-change-transform">
                  <NamePill name={a === "lead" ? "Claude Code · Điều phối" : META[a].name} state={st} selected={sel === a} onClick={() => setSel(a)} />
                </div>
              </div>
            );
          })}
        </div>
        {/* chrome */}
        <div className="absolute inset-x-3 top-3 z-30 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[#7a2b4c] px-3 py-1 text-[12px] font-bold text-white">Đội AI <span className="hidden font-normal opacity-80 sm:inline">· mini marketing team</span></span>
          <button className={pill(!autoRotate)} onClick={() => setAutoRotate((v) => !v)}>{autoRotate ? "Dừng xoay" : "Xoay"}</button>
          <button className={pill(bubbles)} onClick={() => setBubbles((v) => !v)}>Bong bóng</button>
          <button className={pill(false)} onClick={() => setResetKey((k) => k + 1)}>Toàn cảnh</button>
          <button className={pill(demo)} onClick={() => setDemo((v) => !v)}>{demo ? "Dừng demo" : "Tự chạy ▶"}</button>
          <span className="ml-auto flex items-center gap-1.5">
            <span className={`${chip} hidden md:inline`}>5 agent</span>
            <span className={`${chip} hidden md:inline`}>1 bước duyệt</span>
            <Link href="/drafts" className="rounded-full bg-[#7a2b4c] px-3 py-1 text-[12px] font-semibold text-white">Cổng duyệt · {waiting} bài</Link>
          </span>
        </div>
      </div>

      <aside className="card space-y-3 border-pink-200 bg-[#fff7fa] lg:max-h-[64vh] lg:overflow-auto">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white text-2xl shadow-sm" style={{ background: m.fur }} aria-hidden>
            🐱
          </span>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-[#7a2b4c]">{m.name}</div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span className={`inline-block h-2 w-2 rounded-full ${stateOf(sel) === "working" ? "animate-pulse" : ""}`} style={{ background: STATE_COLOR[stateOf(sel)] }} />
              {STATE_LABEL[stateOf(sel)]}
              {since && <span>· từ {since}</span>}
            </div>
          </div>
        </div>
        <p className="text-sm text-zinc-700">{m.job}</p>
        <div>
          <div className="inline-block rounded-2xl rounded-bl-sm bg-[#7a2b4c] px-3 py-1.5 text-[12px] font-semibold text-white">{sel === "lead" ? "Lệnh gần nhất của bạn" : "Sếp giao gì?"}</div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-800">{selected.task ? selected.task.slice(0, 600) : "Chưa có."}</p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#7a2b4c]/70">Báo cáo gần nhất</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{selected.report ? selected.report.slice(0, 900) : "Chưa có."}</p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#7a2b4c]/70">Công cụ</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {m.tools.split(", ").map((t) => (
              <span key={t} className="rounded-md bg-white px-2 py-0.5 text-[12px] text-[#7a2b4c] ring-1 ring-pink-200">{t}</span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
