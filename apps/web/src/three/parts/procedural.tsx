'use client';

import { boardFeatures, type ModelSpec } from '@redcore/domain';
import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PartMaterials } from '../materials';
import { Fan } from './fan';

// Процедурные модели комплектующих и периферии. Габариты — из ModelSpec (метры),
// поэтому длинная видеокарта действительно длиннее, а кулер 168 мм выше кулера 155 мм.
// Начало координат — центр детали; сцена сама центрирует и масштабирует камеру.

type Props<K extends ModelSpec['kind']> = {
  spec: Extract<ModelSpec, { kind: K }>;
  m: PartMaterials;
};

function Box({
  size,
  position = [0, 0, 0],
  material,
  radius = 0,
  castShadow = true,
}: {
  size: [number, number, number];
  position?: [number, number, number];
  material: PartMaterials[keyof PartMaterials];
  radius?: number;
  castShadow?: boolean;
}) {
  if (radius > 0) {
    return (
      <RoundedBox
        args={size}
        radius={radius}
        smoothness={3}
        position={position}
        material={material}
        castShadow={castShadow}
        receiveShadow
      />
    );
  }
  return (
    <mesh position={position} material={material} castShadow={castShadow} receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function Case({ spec, m }: Props<'case'>) {
  const [d, h, w] = spec.size;
  const t = 0.004;
  const fanSize = Math.min(0.14, h * 0.28);
  return (
    <group>
      <Box size={[d, h, w]} material={m.body} radius={0.006} />
      {/* Передняя сетка с вентиляторами за ней */}
      <Box
        size={[t, h * 0.92, w * 0.88]}
        position={[d / 2 + t / 2, 0, 0]}
        material={m.mesh}
        castShadow={false}
      />
      {/* Боковая панель: стекло или металл, внутри — подсветка вентиляторов */}
      {spec.glass ? (
        <>
          <mesh position={[0, 0, w / 2 + 0.0015]} material={m.glass}>
            <boxGeometry args={[d * 0.94, h * 0.94, 0.003]} />
          </mesh>
          {[0.25, -0.05].map((y, i) => (
            <group
              key={i}
              position={[d / 2 - fanSize * 0.7, h * y, w / 2 - 0.03]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <Fan size={fanSize} m={m} rgbRing={spec.rgb || spec.glass} />
            </group>
          ))}
        </>
      ) : (
        <Box
          size={[d * 0.94, h * 0.94, t]}
          position={[0, 0, w / 2]}
          material={m.body}
          castShadow={false}
        />
      )}
      {/* Ножки */}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Box
            key={`${x}${z}`}
            size={[0.04, 0.012, 0.02]}
            position={[(x * d) / 2.6, -h / 2 - 0.006, (z * w) / 2.6]}
            material={m.plastic}
          />
        )),
      )}
      {/* Кнопка питания с кольцом подсветки */}
      <mesh position={[d / 2 - 0.03, h / 2 + 0.001, 0]} rotation={[0, 0, 0]} material={m.rgb}>
        <cylinderGeometry args={[0.006, 0.006, 0.003, 24]} />
      </mesh>
    </group>
  );
}

function Motherboard({ spec, m }: Props<'motherboard'>) {
  const [w, h] = spec.size;
  const pcbT = 0.0016;
  // Координаты разъёмов — общие с раскладкой сборки: процессор и память встают точно в слоты
  const f = boardFeatures(spec);
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <Box size={[w, h, pcbT]} material={m.pcb} />
      {/* Сокет и радиаторы VRM */}
      <Box size={[0.05, 0.05, 0.006]} position={[...f.socket, 0.004]} material={m.aluminium} />
      <Box
        size={[0.06, 0.015, 0.022]}
        position={[f.socket[0], f.socket[1] + h * 0.2, 0.011]}
        material={m.body}
        radius={0.002}
      />
      <Box
        size={[0.015, 0.07, 0.022]}
        position={[f.socket[0] - w * 0.25, f.socket[1] - h * 0.02, 0.011]}
        material={m.body}
        radius={0.002}
      />
      {/* Слоты памяти */}
      {f.dimms.map((at, i) => (
        <Box key={i} size={[0.006, 0.133, 0.008]} position={[...at, 0.004]} material={m.plastic} />
      ))}
      {/* PCIe x16 с металлической защитой */}
      {f.pcie.map((at, i) => (
        <Box key={i} size={[0.09, 0.008, 0.011]} position={[...at, 0.006]} material={m.aluminium} />
      ))}
      {/* Радиаторы M.2 */}
      {f.m2.map((at, i) => (
        <Box
          key={i}
          size={[0.08, 0.024, 0.002]}
          position={[...at, 0.0018]}
          material={m.plastic}
          castShadow={false}
        />
      ))}
      {/* Чипсет и задняя панель с подсветкой */}
      <Box
        size={[0.045, 0.045, 0.008]}
        position={[w * 0.25, -h * 0.25, 0.005]}
        material={m.body}
        radius={0.002}
      />
      <Box
        size={[0.03, 0.12, 0.035]}
        position={[-w * 0.44, h * 0.18, 0.018]}
        material={m.body}
        radius={0.003}
      />
      <Box
        size={[0.002, 0.11, 0.003]}
        position={[-w * 0.425, h * 0.18, 0.036]}
        material={m.rgb}
        castShadow={false}
      />
    </group>
  );
}

function Cpu({ spec, m }: Props<'cpu'>) {
  const [w, h] = spec.size;
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <Box size={[w, h, 0.0012]} material={m.pcb} />
      {/* Крышка теплораспределителя: у AMD — «осьминог», у Intel — прямоугольник */}
      <Box
        size={spec.vendor === 'amd' ? [w * 0.82, h * 0.82, 0.003] : [w * 0.72, h * 0.6, 0.003]}
        position={[0, 0, 0.002]}
        material={m.aluminium}
        radius={0.001}
      />
      {/* Позолоченные контакты снизу */}
      <Box
        size={[w * 0.9, h * 0.9, 0.0002]}
        position={[0, 0, -0.0008]}
        material={m.gold}
        castShadow={false}
      />
    </group>
  );
}

function Gpu({ spec, m }: Props<'gpu'>) {
  const { length: l, height: h, thickness: t } = spec;
  const fanSize = Math.min(h * 0.82, (l * 0.9) / spec.fans);
  return (
    <group>
      {/* Кожух, радиатор под ним и бэкплейт */}
      <Box size={[l, h, t * 0.42]} position={[0, 0, t * 0.29]} material={m.body} radius={0.004} />
      <Box
        size={[l * 0.96, h * 0.9, t * 0.46]}
        position={[0, 0, -t * 0.12]}
        material={m.aluminium}
        castShadow={false}
      />
      <Box size={[l, h, 0.002]} position={[0, 0, -t * 0.38]} material={m.body} />
      {Array.from({ length: spec.fans }, (_, i) => (
        <group key={i} position={[(i - (spec.fans - 1) / 2) * (l / spec.fans), 0, t * 0.51]}>
          <Fan size={fanSize} m={m} depth={0.012} />
        </group>
      ))}
      {/* RGB-полоса по верхней грани и разъём PCIe */}
      {spec.rgb && (
        <Box
          size={[l * 0.6, 0.004, 0.003]}
          position={[l * 0.05, h / 2 + 0.002, t * 0.2]}
          material={m.rgb}
          castShadow={false}
        />
      )}
      <Box
        size={[0.085, 0.008, 0.0016]}
        position={[-l * 0.2, -h / 2 - 0.004, -t * 0.3]}
        material={m.gold}
        castShadow={false}
      />
      {/* Планка крепления */}
      <Box
        size={[0.002, h * 1.05, t * 1.05]}
        position={[-l / 2 - 0.001, 0, 0]}
        material={m.aluminium}
      />
    </group>
  );
}

/** 26 рёбер башни одной геометрией: вместо 26 вызовов отрисовки — один. */
function finGeometry(height: number, depth: number, width: number) {
  const count = 26;
  const fins = Array.from({ length: count }, (_, i) =>
    new THREE.BoxGeometry(depth, 0.0005, width).translate(
      0,
      -height * 0.4 + (i / count) * height * 0.82,
      0,
    ),
  );
  const merged = mergeGeometries(fins, false)!;
  for (const g of fins) g.dispose();
  return merged;
}

function CoolerAir({ spec, m }: Props<'cooler-air'>) {
  const h = spec.height;
  const fins = useMemo(() => finGeometry(h, 0.05, spec.fanSize * 1.02), [h, spec.fanSize]);
  useEffect(() => () => fins.dispose(), [fins]);
  if (spec.lowProfile || h < 0.08) {
    return (
      <group>
        <Box size={[0.1, h * 0.45, 0.1]} position={[0, -h * 0.25, 0]} material={m.aluminium} />
        <group position={[0, h * 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <Fan size={spec.fanSize} m={m} rgbRing={spec.rgb} depth={0.015} />
        </group>
      </group>
    );
  }
  const towerDepth = 0.05;
  const towers = spec.towers === 2 ? [-0.032, 0.032] : [0];
  const fanX = spec.towers === 2 ? [0, 0.085] : [0.04, -0.04];
  return (
    <group>
      {/* Основание и медные тепловые трубки */}
      <Box size={[0.04, 0.01, 0.04]} position={[0, -h / 2 + 0.005, 0]} material={m.copper} />
      {[-0.012, -0.004, 0.004, 0.012].map((z) => (
        <mesh key={z} position={[0, 0, z]} material={m.copper}>
          <cylinderGeometry args={[0.003, 0.003, h * 0.96, 12]} />
        </mesh>
      ))}
      {/* Рёбра радиатора — каждая башня из тонких пластин, слитых в одну геометрию */}
      {towers.map((x) => (
        <group key={x} position={[x * 1.6, h * 0.06, 0]}>
          <mesh geometry={fins} material={m.aluminium} />
          <Box
            size={[towerDepth, 0.006, spec.fanSize * 1.04]}
            position={[0, h * 0.43, 0]}
            material={m.body}
            radius={0.002}
          />
        </group>
      ))}
      {/* Вентиляторы: у двух башен — между ними и спереди, у одной — спереди */}
      {fanX.slice(0, spec.fans).map((x) => (
        <group key={x} position={[x, h * 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Fan size={spec.fanSize} m={m} rgbRing={spec.rgb} />
        </group>
      ))}
    </group>
  );
}

/** Радиатор СЖО с вентиляторами сверху; в конфигураторе ставится под верхнюю панель отдельно. */
export function AioRadiator({ spec, m }: Props<'cooler-aio'>) {
  const n = Math.max(1, Math.round(spec.radiator / spec.fanSize));
  return (
    <group>
      <Box
        size={[spec.radiator + 0.035, spec.thickness, spec.fanSize + 0.004]}
        material={m.aluminium}
      />
      {Array.from({ length: n }, (_, i) => (
        <group
          key={i}
          position={[(i - (n - 1) / 2) * spec.fanSize, spec.thickness / 2 + 0.0125, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <Fan size={spec.fanSize} m={m} rgbRing={spec.rgb} />
        </group>
      ))}
    </group>
  );
}

/** Помпа с кольцом подсветки и (опционально) экраном; ось — +Y, экран смотрит вверх. */
export function AioPump({ spec, m }: Props<'cooler-aio'>) {
  return (
    <group>
      <mesh material={m.body} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.03, 48]} />
      </mesh>
      <mesh
        position={[0, 0.0155, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={spec.display ? m.screen : m.rgb}
      >
        <circleGeometry args={[spec.display ? 0.028 : 0.033, 48]} />
      </mesh>
    </group>
  );
}

function CoolerAio({ spec, m }: Props<'cooler-aio'>) {
  return (
    <group>
      <group position={[0, 0.12, 0]}>
        <AioRadiator spec={spec} m={m} />
      </group>
      <group position={[0, -0.05, 0]}>
        <AioPump spec={spec} m={m} />
      </group>
      {/* Шланги */}
      {[-0.02, 0.02].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]} material={m.plastic}>
          <cylinderGeometry args={[0.005, 0.005, 0.13, 12]} />
        </mesh>
      ))}
    </group>
  );
}

function Ram({ spec, m }: Props<'ram'>) {
  const h = spec.height;
  const l = 0.1335;
  return (
    <group>
      {Array.from({ length: Math.min(spec.modules, 4) }, (_, i) => (
        <group key={i} position={[0, 0, (i - (Math.min(spec.modules, 4) - 1) / 2) * 0.0095]}>
          <Box
            size={[l, h * 0.78, 0.006]}
            position={[0, h * 0.05, 0]}
            material={m.body}
            radius={0.0012}
          />
          <Box
            size={[l * 0.98, h * 0.12, 0.002]}
            position={[0, -h * 0.4, 0]}
            material={m.pcb}
            castShadow={false}
          />
          <Box
            size={[l * 0.96, 0.0025, 0.0016]}
            position={[0, -h * 0.48, 0]}
            material={m.gold}
            castShadow={false}
          />
          {spec.rgb && (
            <Box
              size={[l * 0.96, h * 0.12, 0.0062]}
              position={[0, h * 0.5, 0]}
              material={m.rgb}
              castShadow={false}
            />
          )}
        </group>
      ))}
    </group>
  );
}

function Storage({ spec, m }: Props<'storage'>) {
  if (spec.form === 'm2') {
    return (
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Box size={[0.08, 0.022, 0.0008]} material={m.pcb} />
        <Box
          size={[0.03, 0.016, 0.0012]}
          position={[0.01, 0, 0.001]}
          material={m.plastic}
          castShadow={false}
        />
        <Box
          size={[0.012, 0.012, 0.001]}
          position={[-0.018, 0, 0.001]}
          material={m.plastic}
          castShadow={false}
        />
        <Box
          size={[0.006, 0.02, 0.0004]}
          position={[-0.037, 0, 0]}
          material={m.gold}
          castShadow={false}
        />
        {spec.heatsink && (
          <Box
            size={[0.07, 0.024, 0.008]}
            position={[0.004, 0, 0.0045]}
            material={m.aluminium}
            radius={0.0015}
          />
        )}
      </group>
    );
  }
  const size: [number, number, number] =
    spec.form === '2.5' ? [0.1, 0.007, 0.07] : [0.147, 0.026, 0.1016];
  return (
    <group>
      <Box size={size} material={spec.form === '3.5' ? m.aluminium : m.body} radius={0.002} />
      <Box
        size={[size[0] * 0.7, 0.0005, size[2] * 0.7]}
        position={[0, size[1] / 2 + 0.0003, 0]}
        material={m.plastic}
        castShadow={false}
      />
    </group>
  );
}

function Psu({ spec, m }: Props<'psu'>) {
  const [l, h, w] = spec.size;
  const fan = Math.min(h, w) * 0.85;
  return (
    <group>
      <Box size={[l, h, w]} material={m.body} radius={0.004} />
      <group position={[0, h / 2 + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh material={m.mesh}>
          <circleGeometry args={[fan / 2, 48]} />
        </mesh>
      </group>
      {/* Модульные разъёмы на торце */}
      {Array.from({ length: 6 }, (_, i) => (
        <Box
          key={i}
          size={[0.002, 0.012, 0.018]}
          position={[
            l / 2 + 0.001,
            -h * 0.25 + (i % 2) * 0.02,
            -w * 0.3 + Math.floor(i / 2) * 0.03,
          ]}
          material={m.plastic}
          castShadow={false}
        />
      ))}
    </group>
  );
}

function CaseFans({ spec, m }: Props<'fan'>) {
  return (
    <group>
      {Array.from({ length: spec.count }, (_, i) => (
        <group key={i} position={[(i - (spec.count - 1) / 2) * spec.size * 1.04, 0, 0]}>
          <Fan size={spec.size} m={m} rgbRing={spec.rgb} />
        </group>
      ))}
    </group>
  );
}

function Monitor({ spec, m }: Props<'monitor'>) {
  const width = spec.diagonal * Math.cos(Math.atan(1 / spec.aspect));
  const height = width / spec.aspect;
  return (
    <group>
      <Box
        size={[width + 0.01, height + 0.01, 0.012]}
        position={[0, height / 2 + 0.12, 0]}
        material={m.plastic}
        radius={0.003}
      />
      <mesh position={[0, height / 2 + 0.12, 0.0062]} material={m.screen}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <Box size={[0.04, 0.16, 0.025]} position={[0, 0.08, -0.03]} material={m.aluminium} />
      <Box
        size={[0.24, 0.008, 0.18]}
        position={[0, 0.004, -0.02]}
        material={m.aluminium}
        radius={0.003}
      />
    </group>
  );
}

function Keyboard({ spec, m }: Props<'keyboard'>) {
  const rows = 5;
  const cols = Math.round(spec.width / 0.0195);
  return (
    <group>
      <Box size={[spec.width, 0.02, 0.135]} material={m.body} radius={0.004} />
      {Array.from({ length: rows * cols }, (_, i) => (
        <Box
          key={i}
          size={[0.0165, 0.008, 0.0165]}
          position={[
            -spec.width / 2 + 0.012 + (i % cols) * 0.0195,
            0.013,
            -0.045 + Math.floor(i / cols) * 0.0215,
          ]}
          material={m.plastic}
          castShadow={false}
        />
      ))}
      {spec.rgb && (
        <Box
          size={[spec.width * 0.98, 0.002, 0.13]}
          position={[0, 0.0095, 0]}
          material={m.rgb}
          castShadow={false}
        />
      )}
    </group>
  );
}

function Mouse({ spec, m }: Props<'mouse'>) {
  return (
    <group>
      <mesh scale={[0.032, 0.02, spec.length / 2]} material={m.body} castShadow>
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>
      <Box
        size={[0.004, 0.003, 0.012]}
        position={[0, 0.019, -spec.length * 0.25]}
        material={spec.rgb ? m.rgb : m.plastic}
        castShadow={false}
      />
    </group>
  );
}

function Headset({ m }: Props<'headset'>) {
  return (
    <group>
      <mesh position={[0, 0.09, 0]} rotation={[0, 0, 0]} material={m.body}>
        <torusGeometry args={[0.085, 0.008, 12, 48, Math.PI]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 0.085, 0.04, 0]}
          rotation={[0, 0, (side * Math.PI) / 2]}
        >
          <mesh material={m.body} castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.028, 40]} />
          </mesh>
          <mesh position={[0, -side * 0.015, 0]} material={m.plastic}>
            <cylinderGeometry args={[0.04, 0.04, 0.01, 40]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Mousepad({ spec, m }: Props<'mousepad'>) {
  const [w, h] = spec.size;
  return (
    <group>
      <Box
        size={[w, spec.thickness, h]}
        material={m.plastic}
        radius={Math.min(spec.thickness / 2, 0.003)}
      />
      {spec.rgb && (
        <Box
          size={[w + 0.002, spec.thickness * 0.6, h + 0.002]}
          material={m.rgb}
          castShadow={false}
        />
      )}
    </group>
  );
}

function Webcam({ m }: Props<'webcam'>) {
  return (
    <group>
      <Box size={[0.095, 0.03, 0.025]} material={m.body} radius={0.012} />
      <mesh position={[0, 0, 0.0126]} material={m.glass}>
        <circleGeometry args={[0.009, 32]} />
      </mesh>
      <Box size={[0.03, 0.008, 0.05]} position={[0, -0.02, -0.01]} material={m.plastic} />
    </group>
  );
}

export function ProceduralModel({ spec, m }: { spec: ModelSpec; m: PartMaterials }): ReactNode {
  switch (spec.kind) {
    case 'case':
      return <Case spec={spec} m={m} />;
    case 'motherboard':
      return <Motherboard spec={spec} m={m} />;
    case 'cpu':
      return <Cpu spec={spec} m={m} />;
    case 'gpu':
      return <Gpu spec={spec} m={m} />;
    case 'cooler-air':
      return <CoolerAir spec={spec} m={m} />;
    case 'cooler-aio':
      return <CoolerAio spec={spec} m={m} />;
    case 'ram':
      return <Ram spec={spec} m={m} />;
    case 'storage':
      return <Storage spec={spec} m={m} />;
    case 'psu':
      return <Psu spec={spec} m={m} />;
    case 'fan':
      return <CaseFans spec={spec} m={m} />;
    case 'monitor':
      return <Monitor spec={spec} m={m} />;
    case 'keyboard':
      return <Keyboard spec={spec} m={m} />;
    case 'mouse':
      return <Mouse spec={spec} m={m} />;
    case 'headset':
      return <Headset spec={spec} m={m} />;
    case 'mousepad':
      return <Mousepad spec={spec} m={m} />;
    case 'webcam':
      return <Webcam spec={spec} m={m} />;
  }
}
