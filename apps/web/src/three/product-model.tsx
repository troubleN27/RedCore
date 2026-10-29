'use client';

import type { ModelSpec } from '@redcore/domain';
import { Center, useGLTF } from '@react-three/drei';
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { PartMaterials, Quality } from './materials';
import { builtModel } from './model-registry';
import { ProceduralModel } from './parts/procedural';

/** Если GLB не загрузилась (404, битый файл) — показываем процедурную модель, а не ошибку. */
class GlbBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * GLB-модель. Для «покраски» в цвет исполнения узлы с материалом body получают общий
 * материал корпуса; RGB-узлы (материал rgb*) — общий излучающий материал.
 */
function Glb({ url, m, targetSize }: { url: string; m: PartMaterials; targetSize: number }) {
  const { scene } = useGLTF(url, true, true);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      const name = String((node.material as THREE.Material | undefined)?.name ?? '').toLowerCase();
      if (name.startsWith('body')) node.material = m.body;
      else if (name.startsWith('rgb')) node.material = m.rgb;
      else if (name.startsWith('glass')) node.material = m.glass;
      // Пайплайн упрощения убирает нормали — освещение тогда считается по граням в шейдере.
      // Общие материалы сцены (body/glass) для таких сеток клонируем, чтобы не менять их у остальных
      if (!node.geometry.getAttribute('normal')) {
        const flat = (material: THREE.Material) => {
          if ((material as THREE.MeshStandardMaterial).flatShading) return material;
          const copy = material.clone() as THREE.MeshStandardMaterial;
          copy.flatShading = true;
          return copy;
        };
        node.material = Array.isArray(node.material)
          ? node.material.map(flat)
          : flat(node.material as THREE.Material);
      }
    });
    // Нормализация масштаба: пайплайн приводит модели к метрам, но своя загрузка может быть в мм
    const box = new THREE.Box3().setFromObject(clone);
    const extent = Math.max(...box.getSize(new THREE.Vector3()).toArray());
    if (extent > 0 && (extent > targetSize * 3 || extent < targetSize / 3))
      clone.scale.setScalar(targetSize / extent);
    return clone;
  }, [scene, m, targetSize]);

  // Клон делит геометрию с кэшем useGLTF — освобождаем только при уходе со страницы
  useEffect(() => () => void useGLTF.clear(url), [url]);
  return <primitive object={object} />;
}

export function ProductModel({
  spec,
  m,
  quality,
  customUrl,
  extent,
  onFit,
}: {
  spec: ModelSpec;
  m: PartMaterials;
  quality: Quality;
  customUrl?: string | null;
  extent: number;
  /** Радиус описывающей сферы после центрирования — по нему ставится камера */
  onFit?: (radius: number) => void;
}) {
  const built = builtModel(spec.glbKey);
  // На низком качестве и телефонах — облегчённый LOD1
  const url = customUrl ?? (built ? (quality === 'low' ? built.lod1 : built.lod0) : null);
  // Center меряет содержимое один раз при монтировании — поэтому ожидание GLB (Suspense) снаружи:
  // иначе он мерил пустую группу, и камера настраивалась на модель нулевого размера
  const centered = (node: ReactNode) => (
    <Center onCentered={({ boundingSphere }) => onFit?.(boundingSphere.radius)}>{node}</Center>
  );
  const procedural = centered(<ProceduralModel spec={spec} m={m} />);
  if (!url) return procedural;
  return (
    <GlbBoundary fallback={procedural}>
      <Suspense fallback={null}>{centered(<Glb url={url} m={m} targetSize={extent} />)}</Suspense>
    </GlbBoundary>
  );
}
