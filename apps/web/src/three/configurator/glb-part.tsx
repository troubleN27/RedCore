'use client';

import type { Vec3 } from '@redcore/domain';
import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { PartMaterials } from '../materials';
import { builtModel } from '../model-registry';
import { GlbBoundary, useGlbClone } from '../product-model';

type Axis = 'x' | 'y' | 'z';

/**
 * Подгонка скачанных моделей к деталям сборки. Оси модели сопоставляются с габаритом детали
 * по размеру (длинная сторона — к длинной); `turn` — повороты на 180° вокруг осей корпуса,
 * чтобы модель смотрела нужной стороной (вентиляторы, разъёмы, компоненты платы).
 * `stretch` — растянуть по каждой оси (корпус и блок питания), иначе — единый масштаб по
 * наибольшей стороне.
 */
export const glbFit: Record<string, { turn?: Axis[]; stretch?: boolean }> = {
  case_atx: { stretch: true },
  mb_atx: {},
  cpu_am5: {},
  cpu_intel: {},
  cooler_air: {},
  ram_rgb: {},
  ram_lowprofile: {},
  gpu_3fan: {},
  gpu_2fan: {},
  ssd_m2: {},
  ssd_25: {},
  hdd_35: {},
  psu_atx: { stretch: true },
  fan_120: {},
};

const AXES: Axis[] = ['x', 'y', 'z'];
const UNIT: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

/**
 * Поворот, переводящий оси модели в оси детали: i-я по величине сторона модели ложится
 * на i-ю по величине сторону габарита. Отражение (нечётная перестановка) исправляется
 * разворотом одной оси, чтобы модель не «вывернулась».
 */
function alignRotation(native: THREE.Vector3, target: Vec3): THREE.Matrix4 {
  const n = native.toArray();
  const byN = [0, 1, 2].sort((a, b) => n[b]! - n[a]!);
  const byT = [0, 1, 2].sort((a, b) => target[b]! - target[a]!);
  const columns: THREE.Vector3[] = [];
  for (let rank = 0; rank < 3; rank++) columns[byN[rank]!] = UNIT[AXES[byT[rank]!]!].clone();
  const matrix = new THREE.Matrix4().makeBasis(columns[0]!, columns[1]!, columns[2]!);
  if (matrix.determinant() < 0) {
    columns[byN[2]!]!.negate();
    matrix.makeBasis(columns[0]!, columns[1]!, columns[2]!);
  }
  return matrix;
}

function FittedGlb({
  url,
  fitKey,
  size,
  m,
  onObject,
}: {
  url: string;
  fitKey: string;
  size: Vec3;
  m: PartMaterials;
  onObject?: (object: THREE.Object3D) => void;
}) {
  const source = useGlbClone(url, m, { keepCached: true });
  const fit = glbFit[fitKey] ?? {};
  const object = useMemo(() => {
    // Своя копия (геометрия и материалы общие): исходник не трогаем — расчёт может повториться
    const model = source.clone(true);
    model.updateMatrixWorld(true);
    const native = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const rotation = alignRotation(native, size);
    for (const axis of fit.turn ?? [])
      rotation.premultiply(new THREE.Matrix4().makeRotationAxis(UNIT[axis], Math.PI));
    // Размер модели в осях детали после поворота
    const turned = native.clone().applyMatrix4(new THREE.Matrix4().extractRotation(rotation));
    const extent = [Math.abs(turned.x), Math.abs(turned.y), Math.abs(turned.z)];
    const scale = fit.stretch
      ? new THREE.Vector3(...extent.map((v, i) => (v > 0 ? size[i]! / v : 1)))
      : new THREE.Vector3().setScalar(Math.max(...size) / Math.max(...extent));
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    inner.applyMatrix4(rotation);
    inner.add(model);
    holder.add(inner);
    holder.scale.copy(scale);
    // Центр модели — в центр габарита (пайплайн центрирует, но своя загрузка может не быть)
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    holder.position.sub(box.getCenter(new THREE.Vector3()));
    return holder;
  }, [source, size, fit.turn, fit.stretch]);
  // Готовую модель отдаём наружу после монтирования: расчёт выше может выполниться дважды
  useEffect(() => {
    object.updateMatrixWorld(true);
    onObject?.(object);
  }, [object, onObject]);
  return <primitive object={object} />;
}

/**
 * Скачанная модель детали в габарите `size` (оси корпуса). Пока модель грузится или если её
 * нет, показывается `fallback` — процедурная модель.
 */
export function GlbPart({
  glbKey,
  size,
  m,
  fallback,
  onObject,
}: {
  glbKey: string | null | undefined;
  size: Vec3;
  m: PartMaterials;
  fallback: ReactNode;
  onObject?: (object: THREE.Object3D) => void;
}) {
  const built = builtModel(glbKey);
  if (!built || !glbKey) return <>{fallback}</>;
  return (
    <GlbBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <FittedGlb url={built.lod0} fitKey={glbKey} size={size} m={m} onObject={onObject} />
      </Suspense>
    </GlbBoundary>
  );
}
