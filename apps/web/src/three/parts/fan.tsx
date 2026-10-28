'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PartMaterials } from '../materials';

const BLADES = 7;

/** Рамка вентилятора одной геометрией: четыре стенки и воздуховод — один вызов отрисовки. */
function frameGeometry(size: number, depth: number) {
  const wall = size * 0.06;
  const parts: THREE.BufferGeometry[] = [
    [0, (size - wall) / 2, size, wall],
    [0, -(size - wall) / 2, size, wall],
    [(size - wall) / 2, 0, wall, size],
    [-(size - wall) / 2, 0, wall, size],
  ].map(([x, y, w, h]) => new THREE.BoxGeometry(w, h, depth).translate(x!, y!, 0));
  parts.push(
    new THREE.CylinderGeometry(size * 0.47, size * 0.47, depth * 0.96, 40, 1, true).rotateX(
      Math.PI / 2,
    ),
  );
  const merged = mergeGeometries(
    parts.map((g) => g.toNonIndexed()),
    false,
  )!;
  for (const g of parts) g.dispose();
  return merged;
}

/** Ступица и 7 лопастей с наклоном — тоже одна геометрия (вращается целиком). */
function rotorGeometry(size: number, depth: number) {
  const r = size * 0.44;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(r * 0.55, r * 0.18, r, r * 0.08);
  shape.quadraticCurveTo(r * 0.7, -r * 0.22, 0, -r * 0.1);
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(size * 0.16, size * 0.16, depth * 0.7, 28).rotateX(Math.PI / 2),
  ];
  for (let i = 0; i < BLADES; i++) {
    parts.push(
      new THREE.ExtrudeGeometry(shape, { depth: 0.0015, bevelEnabled: false })
        .rotateX(0.35)
        .rotateZ((i / BLADES) * Math.PI * 2),
    );
  }
  const merged = mergeGeometries(
    parts.map((g) => (g.index ? g.toNonIndexed() : g)),
    false,
  )!;
  for (const g of parts) g.dispose();
  return merged;
}

/**
 * Вентилятор: рамка, ротор и (опционально) кольцо подсветки — 2–3 вызова отрисовки.
 * Ротор крутится в useFrame; при frameloop="demand" в простое кадр не перерисовывается.
 */
export function Fan({
  size,
  m,
  spin = true,
  rgbRing = false,
  depth = 0.025,
}: {
  size: number;
  m: PartMaterials;
  spin?: boolean;
  rgbRing?: boolean;
  depth?: number;
}) {
  const rotor = useRef<THREE.Mesh>(null);
  const frame = useMemo(() => frameGeometry(size, depth), [size, depth]);
  const blades = useMemo(() => rotorGeometry(size, depth), [size, depth]);
  // Геометрии переданы пропсом, а не дочерним элементом — R3F сам их не освободит
  useEffect(
    () => () => {
      frame.dispose();
      blades.dispose();
    },
    [frame, blades],
  );

  useFrame((_, delta) => {
    if (spin && rotor.current) rotor.current.rotation.z -= delta * 9;
  });

  return (
    <group>
      <mesh geometry={frame} material={m.plastic} castShadow />
      {rgbRing && (
        <mesh material={m.rgb}>
          <torusGeometry args={[size * 0.465, size * 0.012, 8, 48]} />
        </mesh>
      )}
      <mesh ref={rotor} geometry={blades} material={rgbRing ? m.mesh : m.plastic} />
    </group>
  );
}
