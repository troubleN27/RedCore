'use client';

import type { AssemblyLayout, PcComponentType } from '@redcore/domain';
import { AdaptiveDpr, CameraControls, ContactShadows, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useMaterialLibrary, type Quality } from '../materials';
import { lowerQuality, qualitySettings } from '../quality';
import { Studio } from '../studio';
import { AssemblyParts, Ghost, type ViewMode } from './assembly-parts';
import { CaseShell } from './case-shell';

export interface AssemblyStats {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  /** Детали, которые сейчас стоят в сцене (без уезжающих) */
  parts: string[];
  /** performance.now() последнего изменения состава сцены */
  updatedAt: number;
}

declare global {
  interface Window {
    /** Для E2E и отладки: состав сцены сборки и renderer.info */
    __redcoreAssembly?: AssemblyStats;
  }
}

export interface AssemblySceneProps {
  layout: AssemblyLayout;
  activeSlot: PcComponentType;
  /** Куда смотрит камера: крупный план слота или обзор всего корпуса */
  cameraSlot: PcComponentType | 'overview';
  mode: ViewMode;
  quality: Quality;
  rgbOn: boolean;
  rgbColor: string;
  /** Подписи деталей в разнесённом виде: productId → название */
  labels: Record<string, string> | null;
  /** false — сцена вне экрана: кадры не рисуются */
  active: boolean;
  resetSignal: number;
  /** prefers-reduced-motion: без анимаций установки и перелётов камеры */
  reducedMotion: boolean;
  snapshot: RefObject<(() => string) | null>;
  onDegrade: (q: Quality) => void;
  onContextLost: () => void;
}

// Обзор — со стороны стекла и чуть спереди; крупные планы — почти в лоб стеклу
const OVERVIEW_DIRECTION = new THREE.Vector3(0.62, 0.38, 1).normalize();
const SLOT_DIRECTION = new THREE.Vector3(0.28, 0.22, 1).normalize();

/** Перелёт камеры к пресету слота при смене шага, режима или по кнопке «обзор». */
function CameraRig({
  layout,
  cameraSlot,
  mode,
  resetSignal,
  reducedMotion,
}: Pick<AssemblySceneProps, 'layout' | 'cameraSlot' | 'mode' | 'resetSignal' | 'reducedMotion'>) {
  const controls = useRef<CameraControls>(null);
  const get = useThree((s) => s.get);
  const preset = layout.cameras[mode === 'exploded' ? 'overview' : cameraSlot];
  const zoomOut = mode === 'exploded' ? 1.25 : 1;
  const [tx, ty, tz] = preset.target;
  const presetDistance = preset.distance;
  const isOverview = preset === layout.cameras.overview;
  const first = useRef(true);

  useEffect(() => {
    const cc = controls.current;
    if (!cc) return;
    const camera = get().camera as THREE.PerspectiveCamera;
    // Пресет считает домен по радиусу; здесь — поправка на угол обзора и узкий кадр телефона
    const fit = 0.42 / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2);
    const distance = (presetDistance * fit * zoomOut) / Math.sqrt(Math.min(1, camera.aspect));
    const dir = isOverview ? OVERVIEW_DIRECTION : SLOT_DIRECTION;
    void cc.setLookAt(
      tx + dir.x * distance,
      ty + dir.y * distance,
      tz + dir.z * distance,
      tx,
      ty,
      tz,
      !first.current && !reducedMotion,
    );
    first.current = false;
  }, [get, tx, ty, tz, presetDistance, isOverview, zoomOut, resetSignal, reducedMotion]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.45}
      minDistance={0.12}
      maxDistance={3}
      dollySpeed={0.6}
    />
  );
}

function Probe({
  snapshot,
  parts,
}: {
  snapshot: AssemblySceneProps['snapshot'];
  parts: RefObject<string[]>;
}) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const ref = snapshot as { current: (() => string) | null };
    // Снимок: рендер кадра и чтение canvas в одной задаче — preserveDrawingBuffer не нужен
    ref.current = () => {
      const { gl, scene, camera } = get();
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    };
    // В dev — доступ к сцене из консоли для отладки раскладки
    if (process.env.NODE_ENV === 'development')
      (window as { __redcoreR3f?: typeof get }).__redcoreR3f = get;
    const timer = setInterval(() => {
      const { render, memory } = get().gl.info;
      window.__redcoreAssembly = {
        ...(window.__redcoreAssembly ?? { updatedAt: 0 }),
        calls: render.calls,
        triangles: render.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        parts: parts.current,
      };
    }, 500);
    return () => {
      ref.current = null;
      clearInterval(timer);
    };
  }, [get, snapshot, parts]);
  return null;
}

function Assembly(props: AssemblySceneProps) {
  const { layout, activeSlot, mode, quality, rgbOn, rgbColor, labels } = props;
  const finishes = [layout.caseSpec.finish, ...layout.placements.map((p) => p.spec.finish)];
  const lib = useMaterialLibrary(finishes, rgbColor, rgbOn, quality);
  const parts = useRef<string[]>([]);
  const invalidate = useThree((s) => s.invalidate);
  const onRendered = useCallback(
    (ids: string[]) => {
      parts.current = ids;
      window.__redcoreAssembly = {
        calls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
        ...window.__redcoreAssembly,
        parts: ids,
        updatedAt: performance.now(),
      };
      invalidate();
    },
    [invalidate],
  );
  const ghost = layout.ghosts[activeSlot];
  const [, h] = layout.caseSpec.size;

  return (
    <>
      <CaseShell
        spec={layout.caseSpec}
        m={lib(layout.caseSpec.finish)}
        panelOff={mode !== 'normal' || !layout.caseSpec.glass}
        instant={props.reducedMotion}
      />
      <AssemblyParts
        instant={props.reducedMotion}
        layout={layout}
        lib={lib}
        mode={mode}
        focusSlot={activeSlot}
        labels={labels}
        onRendered={onRendered}
      />
      {ghost && mode !== 'exploded' && (
        <Ghost position={ghost.position} size={ghost.size} pulse={quality !== 'low'} />
      )}
      {qualitySettings[quality].shadows && (
        <ContactShadows
          position={[0, -h / 2 - 0.012, 0]}
          opacity={0.6}
          scale={1.6}
          blur={2.2}
          far={0.6}
          resolution={512}
          frames={1}
        />
      )}
      <Probe snapshot={props.snapshot} parts={parts} />
    </>
  );
}

export default function AssemblyScene(props: AssemblySceneProps) {
  const { quality, active, onDegrade, onContextLost } = props;
  const settings = qualitySettings[quality];

  return (
    <Canvas
      shadows={settings.shadows}
      dpr={settings.dpr}
      frameloop={!active ? 'never' : settings.demandWhenIdle ? 'demand' : 'always'}
      camera={{ fov: 35, position: [0.8, 0.5, 1.3], near: 0.01, far: 20 }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.AgXToneMapping;
        // Внутри корпуса темнее, чем на витрине: экспозиция выше, чем у просмотра товара
        gl.toneMappingExposure = 1.7;
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          onContextLost();
        });
      }}
      data-testid="assembly-canvas"
    >
      <color attach="background" args={['#0d0d10']} />
      <PerformanceMonitor onDecline={() => onDegrade(lowerQuality(quality))} flipflops={2} />
      <AdaptiveDpr pixelated />
      <hemisphereLight args={['#f5f5f7', '#2a2a31', 1.1]} />
      <directionalLight
        position={[1.2, 2.4, 2]}
        intensity={1.5}
        castShadow={settings.shadows}
        shadow-mapSize={[1024, 1024]}
      />
      {/* Свет со стороны стекла: без него плата в тени стенок корпуса */}
      <directionalLight position={[0.6, 0.8, 2.2]} intensity={2} />
      <Studio front />
      <Assembly {...props} />
      <CameraRig
        layout={props.layout}
        cameraSlot={props.cameraSlot}
        mode={props.mode}
        resetSignal={props.resetSignal}
        reducedMotion={props.reducedMotion}
      />
      {settings.bloom && (
        <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
          <Bloom intensity={0.9} luminanceThreshold={1} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}
