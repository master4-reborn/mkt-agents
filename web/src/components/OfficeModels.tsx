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
// Which way the cat model faces in its own file; the component turns that toward +z.
const CAT_FORWARD_ROT = -Math.PI / 2;

/** Sitting cat (CC-BY, poly.pizza/m/ovFy5UldDq). Normalised to 1 unit tall with paws on y=0, facing +z; `fur` recolours body/spots/ears. */
export function Cat({ fur, anim, faceCamera, children, ...props }: GroupProps & { fur: string; anim: CatAnim; faceCamera?: boolean; children?: React.ReactNode }) {
  const { scene } = useGLTF(M("cats", "cat"));
  const obj = useMemo(() => {
    const o = scene.clone(true);
    const base = new THREE.Color(fur);
    const spot = base.clone().lerp(new THREE.Color("#b8457f"), 0.35);
    const palette: Record<string, THREE.Color> = { body: base, spot, white: new THREE.Color("#fff8fb"), ear: new THREE.Color("#ff9fc2") };
    o.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const swapped = mats.map((m) => {
        const c = palette[m.name];
        if (!c) return m;
        const nm = (m as THREE.MeshStandardMaterial).clone();
        nm.color = c;
        nm.roughness = 0.95;
        nm.metalness = 0;
        return nm;
      });
      mesh.material = swapped.length === 1 ? swapped[0] : swapped;
    });
    o.rotation.y = CAT_FORWARD_ROT;
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const wrap = new THREE.Group();
    const k = 1 / size.y;
    o.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    wrap.add(o);
    wrap.scale.setScalar(k);
    return wrap;
  }, [scene, fur]);
  const spin = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const sp = spin.current;
    if (sp) {
      if (faceCamera) {
        sp.getWorldPosition(camTmp);
        sp.rotation.y = Math.atan2(camera.position.x - camTmp.x, camera.position.z - camTmp.z);
      } else sp.rotation.y = 0;
    }
    const b = body.current;
    if (!b) return;
    if (anim === "walk") {
      b.position.y = Math.abs(Math.sin(t * 10)) * 0.1;
      b.rotation.z = Math.sin(t * 10) * 0.08;
      b.rotation.x = 0;
      b.scale.set(1, 1, 1);
    } else if (anim === "work") {
      b.position.y = 0;
      b.rotation.z = 0;
      b.rotation.x = 0.08 + Math.sin(t * 9) * 0.05;
      b.scale.set(1, 1, 1);
    } else {
      b.position.y = 0;
      b.rotation.x = 0;
      b.rotation.z = Math.sin(t * 1.5) * 0.03;
      b.scale.set(1, 1 + Math.sin(t * 2) * 0.02, 1);
    }
  });
  return (
    <group {...props}>
      <group ref={spin}>
        {children}
        <group ref={body}>
          <primitive object={obj} />
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
    ["cats", "cat"],
    ["castle", "tower-square-base"], ["castle", "tower-square-mid-windows"], ["castle", "tower-square-top-roof-high"], ["castle", "flag-pennant"], ["castle", "flag"],
    ["castle", "wall"], ["castle", "tower-hexagon-base"], ["castle", "tower-hexagon-mid"], ["castle", "tower-hexagon-roof"], ["castle", "gate"],
    ["town", "wall"], ["town", "wall-door"], ["town", "wall-window-shutters"], ["town", "wall-window-round"], ["town", "roof-point"], ["town", "lantern"], ["town", "fountain-round-detail"], ["town", "tree"], ["town", "tree-high-round"], ["town", "hedge"],
    ["food", "cupcake"], ["food", "ice-cream"], ["food", "donut-sprinkles"], ["food", "cake-birthday"], ["food", "lollypop"], ["food", "frappe"], ["food", "cup-tea"],
    ["holiday", "train-locomotive"], ["holiday", "train-tender"], ["holiday", "train-wagon"], ["holiday", "candy-cane-red"], ["holiday", "present-a-round"], ["holiday", "present-b-cube"],
    ["nature", "tree_default"], ["nature", "tree_fat"], ["nature", "tree_oak"], ["nature", "tree_plateau"], ["nature", "tree_cone"], ["nature", "tree_small"], ["nature", "flower_purpleA"], ["nature", "flower_redA"], ["nature", "flower_yellowA"], ["nature", "mushroom_red"], ["nature", "plant_bush"],
  ];
  for (const [k, n] of list) useGLTF.preload(M(k, n));
}
