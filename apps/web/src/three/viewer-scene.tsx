'use client';

import type { ModelSpec } from '@redcore/domain';
import { AdaptiveDpr, ContactShadows, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useMaterials, type Quality } from './materials';
import { ProductModel } from './product-model';
import { lowerQuality, qualitySettings } from './quality';
import { Studio } from './studio';

export interface ViewerStats {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  cameraDistance: number;
}

export interface ViewerSceneProps {
  spec: ModelSpec;
  extent: number;
  quality: Quality;
  autoRotate: boolean;
  rgbOn: boolean;
  rgbColor: string;
  customUrl?: string | null;
  /** false — сцена вне экрана: кадры не рисуются */
  active: boolean;
  resetSignal: number;
  onDegrade: (q: Quality) => void;
  onContextLost: () => void;
  onStats?: (stats: ViewerStats) => void;
}

const VIEW_DIRECTION = new THREE.Vector3(0.72, 0.42, 0.78).normalize();

/** Камера по описывающей сфере модели: вся деталь в кадре при любой форме; сброс — по сигналу. */
function CameraRig({
  radius,
  controls,
  resetSignal,
}: {
  radius: number | null;
  controls: RefObject<OrbitControlsImpl | null>;
  resetSignal: number;
}) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (!radius) return;
    const camera = get().camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = Math.min(1, camera.aspect);
    // Влезть и по вертикали, и по горизонтали (узкий кадр на телефоне)
    const distance = ((radius / Math.sin(fov / 2)) * 1.08) / Math.sqrt(aspect);
    camera.position.copy(VIEW_DIRECTION).multiplyScalar(distance);
    camera.near = distance / 100;
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    const orbit = controls.current;
    if (orbit) {
      orbit.target.set(0, 0, 0);
      orbit.update();
    }
  }, [get, controls, radius, resetSignal]);
  return null;
}

function StatsProbe({ onStats }: { onStats?: ViewerSceneProps['onStats'] }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (!onStats) return;
    const timer = setInterval(() => {
      const { render, memory } = gl.info;
      onStats({
        calls: render.calls,
        triangles: render.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        cameraDistance: Math.round(get().camera.position.length() * 1000) / 1000,
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gl, get, onStats]);
  return null;
}

function Model({
  spec,
  extent,
  quality,
  rgbOn,
  rgbColor,
  customUrl,
  onFit,
}: Omit<
  ViewerSceneProps,
  'active' | 'resetSignal' | 'onDegrade' | 'onContextLost' | 'autoRotate'
> & {
  onFit: (radius: number) => void;
}) {
  const m = useMaterials(spec.finish, rgbColor, rgbOn, quality);
  return (
    <ProductModel
      spec={spec}
      m={m}
      quality={quality}
      customUrl={customUrl}
      extent={extent}
      onFit={onFit}
    />
  );
}

export default function ViewerScene(props: ViewerSceneProps) {
  const { extent, quality, autoRotate, active, resetSignal, onDegrade, onContextLost, onStats } =
    props;
  const settings = qualitySettings[quality];
  const controls = useRef<OrbitControlsImpl | null>(null);
  const [radius, setRadius] = useState<number | null>(null);

  return (
    <Canvas
      shadows={settings.shadows}
      dpr={settings.dpr}
      frameloop={!active ? 'never' : settings.demandWhenIdle && !autoRotate ? 'demand' : 'always'}
      camera={{ fov: 35, position: [extent * 1.4, extent * 0.8, extent * 1.5] }}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.AgXToneMapping;
        gl.toneMappingExposure = 1.35;
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          onContextLost();
        });
      }}
      data-testid="viewer-canvas"
    >
      <color attach="background" args={['#0d0d10']} />
      <PerformanceMonitor onDecline={() => onDegrade(lowerQuality(quality))} flipflops={2} />
      <AdaptiveDpr pixelated />
      <hemisphereLight args={['#f5f5f7', '#2a2a31', 0.6]} />
      <directionalLight
        position={[2, 4, 3]}
        intensity={1.6}
        castShadow={settings.shadows}
        shadow-mapSize={[1024, 1024]}
      />
      <Studio />
      <Model {...props} onFit={setRadius} />
      <CameraRig radius={radius} controls={controls} resetSignal={resetSignal} />
      {settings.shadows && (
        <ContactShadows
          position={[0, -extent * 0.62, 0]}
          opacity={0.55}
          scale={extent * 4}
          blur={2.4}
          far={extent * 1.5}
          resolution={512}
        />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        autoRotate={autoRotate}
        autoRotateSpeed={1.2}
        // Пределы зума — от размера модели: не влететь внутрь и не потерять её из виду
        minDistance={radius ? radius * 1.1 : undefined}
        maxDistance={radius ? radius * 12 : undefined}
      />
      <StatsProbe onStats={onStats} />
      {settings.bloom && (
        <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
          <Bloom intensity={0.9} luminanceThreshold={1} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}
