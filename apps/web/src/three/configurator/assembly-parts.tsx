'use client';

import type { AssemblyLayout, PcComponentType, Placement, Vec3 } from '@redcore/domain';
import { fitsInCase } from '@redcore/domain';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { MaterialLibrary } from '../materials';
import { PlacedModel } from './orient';

export type ViewMode = 'normal' | 'panel' | 'exploded' | 'focus';

const INSTALL_SECONDS = 0.6;
const REMOVE_SECONDS = 0.4;

/**
 * Насколько деталь отходит в разнесённом виде (вдоль своего вектора установки), метры.
 * Плата остаётся на поддоне, остальное расходится слоями: так видно, что на чём стоит.
 */
const EXPLODE: Record<PcComponentType, number> = {
  case: 0,
  motherboard: 0,
  cpu: 0.05,
  cooler: 0.15,
  ram: 0.09,
  gpu: 0.13,
  storage: 0.07,
  psu: 0.16,
  case_fan: 0.09,
};

/** Плавное «въезжание» с лёгким дожимом в конце — щелчок защёлки. */
function easeOutBack(t: number) {
  const s = 0.9;
  const x = t - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
}
const easeInCubic = (t: number) => t * t * t;

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

interface Item {
  key: string;
  placement: Placement;
  leaving: boolean;
  /** Пауза перед въездом: при замене новая деталь ждёт, пока старая выедет */
  delay: number;
  /** Деталь была в сборке при открытии сцены — сразу на месте, без анимации */
  initial: boolean;
}

function reconcile(items: Item[], placements: Placement[]): Item[] {
  const next = new Map(placements.map((p) => [p.id, p]));
  const result: Item[] = items.map((item) => {
    const placement = next.get(item.key);
    if (placement) return { ...item, placement, leaving: false };
    return item.leaving ? item : { ...item, leaving: true };
  });
  const known = new Set(items.map((i) => i.key));
  for (const placement of placements) {
    if (known.has(placement.id)) continue;
    const swapping = result.some((i) => i.leaving && i.placement.slot === placement.slot);
    result.push({
      key: placement.id,
      placement,
      leaving: false,
      delay: swapping ? REMOVE_SECONDS * 0.8 : 0,
      initial: false,
    });
  }
  return result;
}

/**
 * Детали сборки с «присутствием»: убранная из store деталь не исчезает мгновенно,
 * а выезжает по вектору установки и только потом размонтируется.
 */
export function AssemblyParts({
  layout,
  lib,
  mode,
  focusSlot,
  labels,
  instant,
  onRendered,
}: {
  layout: AssemblyLayout;
  lib: MaterialLibrary;
  mode: ViewMode;
  focusSlot: PcComponentType;
  labels: Record<string, string> | null;
  /** prefers-reduced-motion: детали встают на место сразу, без анимации */
  instant: boolean;
  onRendered: (ids: string[]) => void;
}) {
  const { placements } = layout;
  const [items, setItems] = useState<Item[]>(() =>
    placements.map((placement) => ({
      key: placement.id,
      placement,
      leaving: false,
      delay: 0,
      initial: true,
    })),
  );
  const [prev, setPrev] = useState(placements);
  // Сверка со store прямо в рендере (без эффекта) — сцена отражает замену в том же кадре
  if (prev !== placements) {
    setPrev(placements);
    setItems(reconcile(items, placements));
  }

  const present = items.filter((i) => !i.leaving).map((i) => i.key);
  const presentKey = present.join('|');
  useEffect(() => onRendered(presentKey ? presentKey.split('|') : []), [presentKey, onRendered]);

  // Подпись — у первой детали товара (у пары модулей памяти она одна)
  const labelled = new Set<string>();
  const pump = placements.find((p) => p.part === 'pump');
  const radiator = placements.find((p) => p.part === 'radiator');

  return (
    <>
      {items.map((item) => {
        const { placement } = item;
        const label =
          labels && !labelled.has(placement.productId) && !item.leaving
            ? labels[placement.productId]
            : undefined;
        if (label) labelled.add(placement.productId);
        return (
          <AnimatedPart
            key={item.key}
            item={item}
            exploded={mode === 'exploded'}
            instant={instant}
            dim={mode === 'focus' && placement.slot !== focusSlot}
            outOfCase={!fitsInCase(layout, placement, 0.004)}
            label={label}
            alwaysLabel={placement.slot === focusSlot}
            onExited={() =>
              setItems((list) => list.filter((i) => !(i.key === item.key && i.leaving)))
            }
          >
            <PlacedModel
              placement={placement}
              m={lib(placement.spec.finish, mode === 'focus' && placement.slot !== focusSlot)}
            />
            {item.key === pump?.id && radiator && (
              <Hoses
                from={pump.position}
                to={radiator.position}
                radiatorSize={radiator.size}
                lib={lib}
                finish={pump.spec.finish}
              />
            )}
          </AnimatedPart>
        );
      })}
    </>
  );
}

function AnimatedPart({
  item,
  exploded,
  instant,
  dim,
  outOfCase,
  label,
  alwaysLabel,
  onExited,
  children,
}: {
  item: Item;
  exploded: boolean;
  instant: boolean;
  dim: boolean;
  outOfCase: boolean;
  label?: string;
  /** Подпись активного шага видна всегда; остальные — при наведении */
  alwaysLabel: boolean;
  onExited: () => void;
  children: ReactNode;
}) {
  const { placement } = item;
  const group = useRef<THREE.Group>(null);
  const progress = useRef(item.initial ? 1 : 0);
  const explode = useRef(exploded ? 1 : 0);
  const wait = useRef(item.delay);
  // Позиция «на месте» сглаживается: смена корпуса или платы плавно переставляет деталь
  const base = useRef(new THREE.Vector3(...placement.position));
  const exited = useRef(false);
  const [hovered, setHovered] = useState(false);
  const from = useMemo(() => new THREE.Vector3(...placement.installFrom), [placement.installFrom]);
  const explodeDir = useMemo(
    () => new THREE.Vector3(...unit(placement.installFrom)).multiplyScalar(EXPLODE[placement.slot]),
    [placement.installFrom, placement.slot],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g || exited.current) return;
    // Без анимации — «большой шаг времени»: ожидание, въезд и разнесение завершаются за кадр
    const dt = instant ? 10 : Math.min(delta, 0.05);
    if (wait.current > 0) {
      wait.current -= dt;
      g.visible = false;
      state.invalidate();
      return;
    }
    g.visible = true;
    let moving = false;

    const target = item.leaving ? 0 : 1;
    if (progress.current !== target) {
      const step = dt / (item.leaving ? REMOVE_SECONDS : INSTALL_SECONDS);
      progress.current = item.leaving
        ? Math.max(0, progress.current - step)
        : Math.min(1, progress.current + step);
      moving = true;
    }
    if (item.leaving && progress.current === 0) {
      exited.current = true;
      g.visible = false;
      onExited();
      return;
    }

    const explodeTarget = exploded ? 1 : 0;
    explode.current = THREE.MathUtils.damp(explode.current, explodeTarget, 6, dt);
    if (Math.abs(explode.current - explodeTarget) < 0.001) explode.current = explodeTarget;
    else moving = true;

    const goal = new THREE.Vector3(...placement.position);
    if (base.current.distanceToSquared(goal) > 1e-8) {
      base.current.lerp(goal, 1 - Math.exp(-10 * dt));
      moving = true;
    } else base.current.copy(goal);

    const eased = item.leaving ? easeInCubic(progress.current) : easeOutBack(progress.current);
    g.position
      .copy(base.current)
      .addScaledVector(from, 1 - eased)
      .addScaledVector(explodeDir, explode.current);
    // M.2 входит в разъём под углом и опускается на стойку
    g.rotation.y = -(placement.installTilt ?? 0) * Math.max(0, 1 - eased);
    if (moving) state.invalidate();
  });

  return (
    <group
      ref={group}
      position={placement.position}
      visible={item.delay <= 0}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {children}
      {outOfCase && !dim && <ConflictBox size={placement.size} />}
      {label && exploded && (alwaysLabel || hovered) && (
        <Html center position={[0, 0, placement.size[2] / 2 + 0.01]} zIndexRange={[20, 0]}>
          <span className="pointer-events-none rounded bg-black/75 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white">
            {label}
          </span>
        </Html>
      )}
    </group>
  );
}

/** Красный контур вокруг детали, которая выходит за корпус (как и сообщает проверка совместимости). */
function ConflictBox({ size }: { size: Vec3 }) {
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#ff453a" toneMapped={false} />
    </lineSegments>
  );
}

/** Шланги СЖО от помпы к радиатору — в координатах помпы, поэтому едут вместе с ней. */
function Hoses({
  from,
  to,
  radiatorSize,
  lib,
  finish,
}: {
  from: Vec3;
  to: Vec3;
  radiatorSize: Vec3;
  lib: MaterialLibrary;
  finish: Placement['spec']['finish'];
}) {
  const geometries = useMemo(() => {
    const end = new THREE.Vector3(
      to[0] - from[0] - radiatorSize[0] / 2 + 0.02,
      to[1] - from[1],
      to[2] - from[2],
    );
    return [-0.012, 0.012].map((dz) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.03, dz, 0.01),
        new THREE.Vector3(0.07, dz + end.y * 0.3, 0.05),
        new THREE.Vector3(end.x * 0.6, end.y * 0.8, end.z * 0.5 + 0.04),
        new THREE.Vector3(end.x, end.y, end.z + dz),
      ]);
      return new THREE.TubeGeometry(curve, 32, 0.005, 8, false);
    });
  }, [from, to, radiatorSize]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  const m = lib(finish);
  return (
    <>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={m.plastic} />
      ))}
    </>
  );
}

/** «Призрак» пустого слота: красный полупрозрачный объём там, куда встанет деталь. */
export function Ghost({ position, size, pulse }: { position: Vec3; size: Vec3; pulse: boolean }) {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size]);
  useEffect(() => () => edges.dispose(), [edges]);
  useFrame((state) => {
    if (!pulse || !material.current) return;
    material.current.opacity = 0.14 + Math.sin(state.clock.elapsedTime * 3) * 0.07;
    state.invalidate();
  });
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshBasicMaterial
          ref={material}
          color="#ff2800"
          transparent
          opacity={0.16}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#ff2800" toneMapped={false} />
      </lineSegments>
    </group>
  );
}
