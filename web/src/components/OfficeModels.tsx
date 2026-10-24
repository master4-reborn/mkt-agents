"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
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

export type CatAnim = "Idle" | "Walk" | "Dance" | "Yes" | "No" | "Jump";

/** The chubby Quaternius cat (CC0), recoloured per agent and driven by one of its animations. */
export function Cat({ fur, stripes, anim, ...props }: GroupProps & { fur: string; stripes: string; anim: CatAnim }) {
  const { scene, animations } = useGLTF(M("cats", "cat"));
  const obj = useMemo(() => {
    const o = SkeletonUtils.clone(scene);
    o.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const swap = (m: THREE.Material) => {
        const c = m.name === "Cat_Main" ? fur : m.name === "Cat_Secondary" ? stripes : m.name === "Ears" ? "#ff7fb0" : m.name === "Eye_White" ? "#ffffff" : null;
        if (!c) return m;
        const nm = (m as THREE.MeshStandardMaterial).clone();
        nm.color = new THREE.Color(c);
        nm.roughness = 0.9;
        nm.metalness = 0;
        return nm;
      };
      mesh.material = mats.length === 1 ? swap(mats[0]) : mats.map(swap);
      mesh.castShadow = true;
    });
    return o;
  }, [scene, fur, stripes]);
  const root = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, root);
  const current = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    const next = actions[`CharacterArmature|${anim}`];
    if (!next) return;
    const prev = current.current;
    if (prev && prev !== next) prev.fadeOut(0.25);
    next.reset().fadeIn(0.25).play();
    current.current = next;
  }, [actions, anim]);
  // model is centred on its origin and ~1.7 tall; lift it so its feet sit on y=0
  return (
    <group {...props}>
      <group ref={root} position={[0, 0.91, 0]}>
        <primitive object={obj} />
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
