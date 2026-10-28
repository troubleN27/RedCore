'use client';

import type { ModelSpec } from '@redcore/domain';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PartMaterials } from '../materials';

const T = 0.004;

/**
 * Корпус для сборки: стенки по отдельности (поддон платы, верх, низ, тыл, сетка спереди),
 * внутри пусто. Боковая панель снимается — уезжает к зрителю и тает.
 */
export function CaseShell({
  spec,
  m,
  panelOff,
  instant = false,
}: {
  spec: Extract<ModelSpec, { kind: 'case' }>;
  m: PartMaterials;
  panelOff: boolean;
  instant?: boolean;
}) {
  const [d, h, w] = spec.size;
  const panel = useRef<THREE.Mesh>(null);
  const progress = useRef(panelOff ? 1 : 0);
  // Своя копия материала панели: прозрачность анимируется, общий материал не трогаем.
  // Стекло — без transmission: тонированное с бликами, сквозь него хорошо видно сборку
  const panelMaterial = useMemo(() => {
    if (!spec.glass) {
      const material = m.body.clone();
      material.transparent = true;
      return material;
    }
    return new THREE.MeshPhysicalMaterial({
      color: '#15151b',
      metalness: 0,
      roughness: 0.03,
      clearcoat: 1,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
  }, [spec.glass, m]);
  const baseOpacity = spec.glass ? 0.2 : 1;
  useEffect(() => () => panelMaterial.dispose(), [panelMaterial]);

  useFrame((state, delta) => {
    const target = panelOff ? 1 : 0;
    const p = THREE.MathUtils.damp(progress.current, target, 7, instant ? 10 : delta);
    progress.current = Math.abs(p - target) < 0.002 ? target : p;
    const mesh = panel.current;
    if (!mesh) return;
    mesh.position.z = w / 2 - 0.0015 + progress.current * 0.32;
    (mesh.material as THREE.Material).opacity = baseOpacity * (1 - progress.current);
    mesh.visible = progress.current < 0.99;
    if (progress.current !== target) state.invalidate();
  });

  return (
    <group>
      {/* Поддон платы — задняя стенка со стороны, противоположной стеклу */}
      <mesh position={[0, 0, -w / 2 + T / 2]} material={m.body} receiveShadow>
        <boxGeometry args={[d, h, T]} />
      </mesh>
      <mesh position={[0, h / 2 - T / 2, 0]} material={m.body} receiveShadow>
        <boxGeometry args={[d, T, w]} />
      </mesh>
      <mesh position={[0, -h / 2 + T / 2, 0]} material={m.body} receiveShadow>
        <boxGeometry args={[d, T, w]} />
      </mesh>
      {/* Тыл: стенка и заглушки слотов расширения */}
      <mesh position={[-d / 2 + T / 2, 0, 0]} material={m.body} receiveShadow>
        <boxGeometry args={[T, h, w]} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh
          key={i}
          position={[-d / 2 + T + 0.0008, h * 0.05 - i * 0.0203, -w / 2 + 0.06]}
          material={m.aluminium}
        >
          <boxGeometry args={[0.0016, 0.016, 0.1]} />
        </mesh>
      ))}
      {/* Передняя сетка */}
      <mesh position={[d / 2 - T / 2, 0, 0]} material={m.mesh}>
        <boxGeometry args={[T, h, w]} />
      </mesh>
      {/* Боковая панель */}
      <mesh ref={panel} position={[0, 0, w / 2 - 0.0015]} material={panelMaterial}>
        <boxGeometry args={[d * 0.98, h * 0.98, 0.003]} />
      </mesh>
      {/* Ножки и кнопка питания */}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh
            key={`${x}${z}`}
            position={[(x * d) / 2.6, -h / 2 - 0.006, (z * w) / 2.6]}
            material={m.plastic}
          >
            <boxGeometry args={[0.04, 0.012, 0.02]} />
          </mesh>
        )),
      )}
      <mesh position={[d / 2 - 0.03, h / 2 + 0.0015, 0]} material={m.rgb}>
        <cylinderGeometry args={[0.006, 0.006, 0.003, 24]} />
      </mesh>
    </group>
  );
}
