"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";

type GroupProps = Omit<ThreeElements["group"], "ref" | "children">;

const M = (kit: string, name: string) => `/models/${kit}/${name}.glb`;

/** A static kit piece. `color` replaces every material with a flat colour; `recolor` maps material names to colours. */
export function Piece({ kit, name, color, recolor, ...props }: GroupProps & { kit: string; name: string; color?: string; recolor?: Record<string, string> }) {
  const { scene } = useGLTF(M(kit, name));
  const obj = useMemo(() => {
    const o = scene.clone(true);
    if (color || recolor) {
      o.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.material = mats.map((m) => {
          const name = (m as THREE.Material).name;
          const c = color ?? recolor?.[name];
          if (!c) return m;
          return new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0, flatShading: false });
        }) as THREE.Material[];
        if ((mesh.material as THREE.Material[]).length === 1) mesh.material = (mesh.material as THREE.Material[])[0];
      });
    }
    return o;
  }, [scene, color, recolor]);
  return (
    <group {...props}>
      <primitive object={obj} />
    </group>
  );
}

export type CatAnim = "idle" | "walk" | "work";
const camTmp = new THREE.Vector3();
const WHITE = "#fff8fb";
const SIDES = [-1, 1] as const;

/** Chibi cat built from primitives: ~1.1 units tall, paws on y=0, facing +z. `fur` sets the coat; ears, nose and blush stay pink. */
export function Cat({ fur, anim, faceCamera, children, ...props }: GroupProps & { fur: string; anim: CatAnim; faceCamera?: boolean; children?: React.ReactNode }) {
  const m = useMemo(() => {
    const base = new THREE.Color(fur);
    const mk = (color: THREE.Color | string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });
    return {
      fur: mk(base),
      dark: mk(base.clone().lerp(new THREE.Color("#b8457f"), 0.35)),
      white: mk(WHITE),
      pink: mk("#ffb3cc"),
      nose: mk("#ff7fa8", { roughness: 0.6 }),
      blush: mk("#ff8fb8", { transparent: true, opacity: 0.55 }),
      eye: mk("#2b1b24", { roughness: 0.4 }),
      shine: mk("#ffffff", { roughness: 0.2 }),
      whisker: mk("#9c6b84"),
    };
  }, [fur]);
  const tailCurve = useMemo(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.22, -0.04, -0.02), new THREE.Vector3(0.4, 0.12, 0.1), new THREE.Vector3(0.38, 0.35, 0.22)]),
    [],
  );
  // Per-cat phase so blinks and tail wags are not in sync.
  const phase = (fur.charCodeAt(1) + fur.charCodeAt(3)) % 7;
  const spin = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Group>(null);
  const earR = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Group>(null);
  const eyeR = useRef<THREE.Group>(null);
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime() + phase;
    const sp = spin.current;
    if (sp) {
      if (faceCamera) {
        sp.getWorldPosition(camTmp);
        sp.rotation.y = Math.atan2(camera.position.x - camTmp.x, camera.position.z - camTmp.z);
      } else sp.rotation.y = 0;
    }
    const b = body.current;
    const h = head.current;
    if (!b || !h) return;
    if (anim === "walk") {
      b.position.y = Math.abs(Math.sin(t * 10)) * 0.08;
      b.rotation.z = Math.sin(t * 10) * 0.06;
      b.scale.y = 1;
      h.rotation.set(0, 0, 0);
    } else if (anim === "work") {
      b.position.y = 0;
      b.rotation.z = 0;
      b.scale.y = 1;
      h.rotation.set(0.1 + Math.sin(t * 9) * 0.06, 0, 0);
    } else {
      b.position.y = 0;
      b.rotation.z = Math.sin(t * 1.5) * 0.02;
      b.scale.y = 1 + Math.sin(t * 2) * 0.015;
      h.rotation.set(0, 0, Math.sin(t * 0.8) * 0.06);
    }
    if (tail.current) tail.current.rotation.y = anim === "work" ? Math.sin(t * 5) * 0.25 : Math.sin(t * 2.2) * 0.4;
    const tw = Math.max(0, Math.sin(t * 0.9)) ** 30 * 0.25;
    if (earL.current) earL.current.rotation.z = 0.3 + tw;
    if (earR.current) earR.current.rotation.z = -0.3 - tw;
    const blink = t % 3.7 < 0.12 ? 0.12 : 1;
    if (eyeL.current) eyeL.current.scale.y = blink;
    if (eyeR.current) eyeR.current.scale.y = blink;
  });
  return (
    <group {...props}>
      <group ref={spin}>
        {children}
        <group ref={body}>
          <mesh position={[0, 0.36, 0]} scale={[1.15, 1, 1.05]} material={m.fur}>
            <sphereGeometry args={[0.36, 32, 24]} />
          </mesh>
          <mesh position={[0, 0.3, 0.2]} scale={[1, 1, 0.55]} material={m.white}>
            <sphereGeometry args={[0.22, 24, 16]} />
          </mesh>
          {SIDES.map((s) => (
            <group key={s}>
              <mesh position={[s * 0.14, 0.075, 0.3]} scale={[1, 0.8, 1.25]} material={m.fur}>
                <sphereGeometry args={[0.085, 20, 14]} />
              </mesh>
              <mesh position={[s * 0.32, 0.09, 0.1]} scale={[1, 0.75, 1.3]} material={m.fur}>
                <sphereGeometry args={[0.11, 20, 14]} />
              </mesh>
            </group>
          ))}
          <group ref={tail} position={[0.1, 0.15, -0.32]}>
            <mesh material={m.fur}>
              <tubeGeometry args={[tailCurve, 24, 0.055, 10, false]} />
            </mesh>
            <mesh position={[0.38, 0.35, 0.22]} material={m.dark}>
              <sphereGeometry args={[0.06, 16, 12]} />
            </mesh>
          </group>
          <group ref={head} position={[0, 0.72, 0.02]}>
            <mesh scale={[1.12, 0.95, 1]} material={m.fur}>
              <sphereGeometry args={[0.28, 32, 24]} />
            </mesh>
            <mesh position={[0, -0.06, 0.22]} scale={[1.5, 0.8, 0.7]} material={m.white}>
              <sphereGeometry args={[0.13, 24, 16]} />
            </mesh>
            <mesh position={[0, 0.262, 0.07]} rotation={[-0.5, 0, 0]} scale={[0.035, 0.012, 0.09]} material={m.dark}>
              <sphereGeometry args={[1, 12, 8]} />
            </mesh>
            {SIDES.map((s) => (
              <mesh key={s} position={[s * 0.085, 0.25, 0.06]} rotation={[-0.5, 0, -s * 0.5]} scale={[0.03, 0.012, 0.08]} material={m.dark}>
                <sphereGeometry args={[1, 12, 8]} />
              </mesh>
            ))}
            {SIDES.map((s) => (
              <group key={s} ref={s < 0 ? earL : earR} position={[s * 0.2, 0.22, 0]}>
                <mesh position={[0, 0.09, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.55]} material={m.fur}>
                  <coneGeometry args={[0.115, 0.2, 4]} />
                </mesh>
                <mesh position={[0, 0.075, 0.035]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.5]} material={m.pink}>
                  <coneGeometry args={[0.07, 0.13, 4]} />
                </mesh>
              </group>
            ))}
            {SIDES.map((s) => (
              <group key={s} ref={s < 0 ? eyeL : eyeR} position={[s * 0.115, 0.03, 0.25]}>
                <mesh material={m.eye}>
                  <sphereGeometry args={[0.046, 20, 14]} />
                </mesh>
                <mesh position={[s * 0.014, 0.016, 0.036]} material={m.shine}>
                  <sphereGeometry args={[0.016, 10, 8]} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, -0.035, 0.335]} scale={[1.3, 0.8, 0.8]} material={m.nose}>
              <sphereGeometry args={[0.03, 16, 12]} />
            </mesh>
            {SIDES.map((s) => (
              <mesh key={s} position={[s * 0.03, -0.065, 0.33]} rotation={[0, 0, Math.PI]} material={m.eye}>
                <torusGeometry args={[0.028, 0.005, 6, 12, Math.PI]} />
              </mesh>
            ))}
            {SIDES.map((s) => (
              <mesh key={s} position={[s * 0.2, -0.04, 0.215]} rotation={[0, s * 0.55, 0]} material={m.blush}>
                <circleGeometry args={[0.045, 20]} />
              </mesh>
            ))}
            {SIDES.map((s) =>
              [-1, 0, 1].map((k) => (
                <mesh key={`${s}${k}`} position={[s * 0.3, -0.03 + k * 0.022, 0.24]} rotation={[0, -s * 0.45, Math.PI / 2 + k * 0.12 * s]} material={m.whisker}>
                  <cylinderGeometry args={[0.004, 0.004, 0.22, 5]} />
                </mesh>
              )),
            )}
          </group>
        </group>
      </group>
    </group>
  );
}

/** Castle for the lead, assembled from the Kenney castle kit (units: 1 = one kit block). */
export function Castle(props: GroupProps) {
  const corners: [number, number][] = [
    [-1.5, -1.5],
    [1.5, -1.5],
    [-1.5, 1.5],
    [1.5, 1.5],
  ];
  const walls: [number, number, number][] = [
    [-0.5, -1.5, 0], [0.5, -1.5, 0],
    [-0.5, 1.5, 0], [0.5, 1.5, 0],
    [-1.5, -0.5, Math.PI / 2], [-1.5, 0.5, Math.PI / 2],
    [1.5, -0.5, Math.PI / 2], [1.5, 0.5, Math.PI / 2],
  ];
  return (
    <group {...props}>
      {corners.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <Piece kit="castle" name="tower-square-base" />
          <Piece kit="castle" name="tower-square-mid-windows" position={[0, 1.01, 0]} />
          <Piece kit="castle" name="tower-square-top-roof-high" position={[0, 2.02, 0]} />
          <Piece kit="castle" name="flag-pennant" position={[0, 3.3, 0]} rotation={[0, Math.PI / 4, 0]} scale={0.8} />
        </group>
      ))}
      {walls.map(([x, z, r], i) => (
        <Piece key={i} kit="castle" name="wall" position={[x, 0, z]} rotation={[0, r, 0]} />
      ))}
      {/* keep */}
      <group position={[0, 0.6, 0]}>
        <Piece kit="castle" name="tower-hexagon-base" scale={[1.6, 1, 1.6]} />
        <Piece kit="castle" name="tower-hexagon-mid" position={[0, 1.31, 0]} scale={[1.6, 1, 1.6]} />
        <Piece kit="castle" name="tower-hexagon-base" position={[0, 1.77, 0]} scale={[1.3, 1, 1.3]} />
        <Piece kit="castle" name="tower-hexagon-mid" position={[0, 3.08, 0]} scale={[1.3, 1, 1.3]} />
        <Piece kit="castle" name="tower-hexagon-roof" position={[0, 3.54, 0]} scale={[1.3, 1.3, 1.3]} />
        <Piece kit="castle" name="flag" position={[0, 4.6, 0]} />
      </group>
      <Piece kit="castle" name="gate" position={[0, 0, 2.06]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1.4, 1.5]} />
      <Piece kit="town" name="lantern" position={[-1.1, 0, 2.3]} scale={0.8} />
      <Piece kit="town" name="lantern" position={[1.1, 0, 2.3]} scale={0.8} />
    </group>
  );
}

/** A small town-kit house with a flat-coloured roof; the door faces local +x. */
export function House({ roof, ...props }: GroupProps & { roof: string }) {
  const faces: [string, number][] = [
    ["wall-door", 0],
    ["wall-window-shutters", Math.PI / 2],
    ["wall", Math.PI],
    ["wall-window-round", -Math.PI / 2],
  ];
  return (
    <group {...props}>
      {faces.map(([name, r]) => (
        <Piece key={name} kit="town" name={name} rotation={[0, r, 0]} />
      ))}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.82, 1, 0.82]} />
        <meshStandardMaterial color="#fff3f8" roughness={1} />
      </mesh>
      <Piece kit="town" name="roof-point" position={[0, 1, 0]} color={roof} />
    </group>
  );
}

const LEAF = ["#ff9fc6", "#ffc1d9", "#b8ead5", "#d6c5ff", "#ffd3e6"];

export function NatureTree({ kind, leaf, ...props }: GroupProps & { kind: "tree_default" | "tree_fat" | "tree_oak" | "tree_plateau" | "tree_cone" | "tree_small"; leaf: number }) {
  return <Piece kit="nature" name={kind} recolor={{ leafsGreen: LEAF[leaf % LEAF.length], leafsDark: LEAF[(leaf + 1) % LEAF.length] }} {...props} />;
}

export function preloadOffice() {
  const list: [string, string][] = [
    ["castle", "tower-square-base"], ["castle", "tower-square-mid-windows"], ["castle", "tower-square-top-roof-high"], ["castle", "flag-pennant"], ["castle", "flag"],
    ["castle", "wall"], ["castle", "tower-hexagon-base"], ["castle", "tower-hexagon-mid"], ["castle", "tower-hexagon-roof"], ["castle", "gate"],
    ["town", "wall"], ["town", "wall-door"], ["town", "wall-window-shutters"], ["town", "wall-window-round"], ["town", "roof-point"], ["town", "lantern"], ["town", "fountain-round-detail"], ["town", "tree"], ["town", "tree-high-round"], ["town", "hedge"],
    ["food", "cupcake"], ["food", "ice-cream"], ["food", "donut-sprinkles"], ["food", "cake-birthday"], ["food", "lollypop"], ["food", "frappe"], ["food", "cup-tea"],
    ["holiday", "train-locomotive"], ["holiday", "train-tender"], ["holiday", "train-wagon"], ["holiday", "candy-cane-red"], ["holiday", "present-a-round"], ["holiday", "present-b-cube"],
    ["nature", "tree_default"], ["nature", "tree_fat"], ["nature", "tree_oak"], ["nature", "tree_plateau"], ["nature", "tree_cone"], ["nature", "tree_small"], ["nature", "flower_purpleA"], ["nature", "flower_redA"], ["nature", "flower_yellowA"], ["nature", "mushroom_red"], ["nature", "plant_bush"],
  ];
  for (const [k, n] of list) useGLTF.preload(M(k, n));
}
