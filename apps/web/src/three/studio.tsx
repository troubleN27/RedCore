'use client';

import { Environment, Lightformer } from '@react-three/drei';

/** Студийный свет без загрузки HDRI: лайтформеры + красный контровой, как в фирменном стиле. */
export function Studio({ front = false }: { front?: boolean }) {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={1.6}>
      <Lightformer
        intensity={2.2}
        position={[0, 5, -2]}
        scale={[10, 1, 1]}
        rotation-x={Math.PI / 2}
      />
      <Lightformer
        intensity={1.4}
        position={[-5, 1, 1]}
        scale={[3, 4, 1]}
        rotation-y={Math.PI / 2}
      />
      <Lightformer
        intensity={1.2}
        position={[5, 1, 1]}
        scale={[3, 4, 1]}
        rotation-y={-Math.PI / 2}
      />
      {/* Софтбокс за спиной зрителя — для сцены сборки, иначе внутренности корпуса в тени */}
      {front && <Lightformer intensity={1.6} position={[0, 1, 5]} scale={[6, 3, 1]} />}
      <Lightformer intensity={0.55} color="#ff2800" position={[0, -0.5, -5]} scale={[8, 1.2, 1]} />
    </Environment>
  );
}
