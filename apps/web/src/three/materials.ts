import { finishColors, type Finish } from '@redcore/domain';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export type Quality = 'high' | 'medium' | 'low';

export interface PartMaterials {
  /** Покраска корпуса/кожуха в цвет исполнения */
  body: THREE.MeshStandardMaterial;
  /** Брашированный алюминий: радиаторы, рёбра, крышки */
  aluminium: THREE.MeshStandardMaterial;
  /** Тёмный матовый пластик */
  plastic: THREE.MeshStandardMaterial;
  /** Текстолит платы */
  pcb: THREE.MeshStandardMaterial;
  /** Медь тепловых трубок и контактов */
  copper: THREE.MeshStandardMaterial;
  /** Позолоченные контакты */
  gold: THREE.MeshStandardMaterial;
  /** Закалённое стекло */
  glass: THREE.Material;
  /** Сетка передней панели */
  mesh: THREE.MeshStandardMaterial;
  /** RGB: излучающий материал вне тонмаппинга — светится через bloom */
  rgb: THREE.MeshStandardMaterial;
  /** Экран монитора */
  screen: THREE.MeshStandardMaterial;
}

/**
 * Общая библиотека PBR-материалов: одна на сцену, чтобы детали разных источников
 * (GLB и процедурные) выглядели в одном стиле. Пересоздаётся только при смене цвета/качества.
 */
export function useMaterials(
  finish: Finish,
  rgbColor: string,
  rgbOn: boolean,
  quality: Quality,
): PartMaterials {
  const materials = useMemo(
    () => createMaterials(finish, rgbColor, rgbOn, quality),
    [finish, rgbColor, rgbOn, quality],
  );

  // Прошлый набор освобождаем сразу после замены — иначе смена цвета копит текстуры в GPU
  useEffect(() => () => disposeMaterials(materials), [materials]);
  return materials;
}

export function createMaterials(
  finish: Finish,
  rgbColor: string,
  rgbOn: boolean,
  quality: Quality,
): PartMaterials {
  const color = finishColors[finish];
  const light = finish === 'white' || finish === 'silver' || finish === 'pink';
  return {
    body: new THREE.MeshStandardMaterial({
      color,
      metalness: light ? 0.25 : 0.55,
      roughness: light ? 0.45 : 0.38,
    }),
    aluminium: new THREE.MeshStandardMaterial({
      color: '#c9ccd1',
      metalness: 0.92,
      roughness: 0.32,
    }),
    plastic: new THREE.MeshStandardMaterial({
      color: '#26262c',
      metalness: 0.1,
      roughness: 0.6,
    }),
    pcb: new THREE.MeshStandardMaterial({
      color: light ? '#d8d9dc' : '#101317',
      metalness: 0.2,
      roughness: 0.55,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: '#c8794a',
      metalness: 0.95,
      roughness: 0.28,
    }),
    gold: new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.25 }),
    glass:
      quality === 'high'
        ? new THREE.MeshPhysicalMaterial({
            color: '#0b0b0e',
            metalness: 0,
            roughness: 0.04,
            transmission: 0.92,
            thickness: 0.004,
            ior: 1.5,
            transparent: true,
          })
        : new THREE.MeshStandardMaterial({
            color: '#0d0d12',
            metalness: 0.6,
            roughness: 0.08,
            transparent: true,
            opacity: 0.28,
          }),
    mesh: new THREE.MeshStandardMaterial({
      color: light ? '#cfd1d4' : '#0e0e11',
      metalness: 0.4,
      roughness: 0.8,
    }),
    rgb: new THREE.MeshStandardMaterial({
      color: '#000000',
      emissive: rgbOn ? rgbColor : '#000000',
      emissiveIntensity: rgbOn ? 2.4 : 0,
      toneMapped: false,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: '#050507',
      metalness: 0.2,
      roughness: 0.15,
      emissive: '#1a0603',
      emissiveIntensity: 0.6,
    }),
  } satisfies PartMaterials;
}

/** Приглушённый вариант набора: в режиме подсветки остальные детали становятся полупрозрачными. */
function dimMaterials(materials: PartMaterials): PartMaterials {
  for (const material of Object.values(materials)) {
    material.transparent = true;
    material.opacity = 0.12;
    material.depthWrite = false;
  }
  return materials;
}

export type MaterialLibrary = (finish: Finish, dim?: boolean) => PartMaterials;

/**
 * Наборы материалов для сцены сборки: по одному на цвет исполнения (и приглушённый),
 * а не на каждую деталь. Замена детали не создаёт материалов, если её цвет уже есть в сцене.
 */
export function useMaterialLibrary(
  finishes: Finish[],
  rgbColor: string,
  rgbOn: boolean,
  quality: Quality,
): MaterialLibrary {
  const key = [...new Set(finishes)].sort().join(',');
  const sets = useMemo(() => {
    const map = new Map<string, PartMaterials>();
    for (const finish of key.split(',').filter(Boolean) as Finish[]) {
      map.set(finish, createMaterials(finish, rgbColor, rgbOn, quality));
      map.set(`${finish}:dim`, dimMaterials(createMaterials(finish, rgbColor, rgbOn, quality)));
    }
    return map;
  }, [key, rgbColor, rgbOn, quality]);
  useEffect(() => () => sets.forEach(disposeMaterials), [sets]);
  return (finish, dim = false) =>
    sets.get(dim ? `${finish}:dim` : finish) ?? sets.values().next().value!;
}

/** Освобождение GPU-ресурсов материалов при размонтировании (защита от утечек). */
export function disposeMaterials(materials: PartMaterials) {
  for (const material of Object.values(materials)) material.dispose();
}
