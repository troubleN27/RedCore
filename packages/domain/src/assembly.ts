import type { Build } from './catalog';
import { modelSpecFor, type ModelSpec } from './model3d';
import type { PcComponentType } from './specs/enums';

// Раскладка сборки в 3D-корпусе (план, §11 «Якоря»). Чистая функция: сцена конфигуратора
// только рисует её результат, а тесты проверяют, что совместимая сборка помещается в корпус.
//
// Система координат корпуса: начало — центр корпуса, +X — к передней панели, +Y — вверх,
// +Z — к стеклянной боковой панели (к зрителю). Единицы — метры.

export type Vec3 = [number, number, number];

/**
 * Ориентация детали в корпусе. Процедурные модели построены в своих осях;
 * сцена переводит ориентацию в повороты (см. apps/web/src/three/configurator/orient.tsx).
 */
export type Orientation =
  | 'board' // плоские детали платы: плата, CPU, M.2 — в плоскости XY лицом к +Z
  | 'gpu' // карта в слоте PCIe: длина по X, высота к +Z, вентиляторы вниз
  | 'tower' // башенный кулер: от сокета к +Z
  | 'pump' // помпа СЖО на сокете
  | 'dimm' // модули памяти: длина по Y, высота к +Z
  | 'psu' // блок питания вентилятором вниз
  | 'fan-front'
  | 'fan-top'
  | 'fan-rear'
  | 'radiator-top'
  | 'flat'; // диски в отсеках

export interface Placement {
  /** Стабильный ключ: слот + товар + номер — по нему сцена понимает, что деталь заменили */
  id: string;
  slot: PcComponentType;
  productId: string;
  spec: ModelSpec;
  /** Часть составной детали: у СЖО помпа и радиатор ставятся отдельно */
  part?: 'pump' | 'radiator';
  position: Vec3;
  orientation: Orientation;
  /** Габарит в осях корпуса (для «призрака», подсветки и проверки «влезает ли») */
  size: Vec3;
  /** Откуда деталь въезжает при установке (смещение от места, метры); в разнесённом виде ×2,5 */
  installFrom: Vec3;
  /** Начальный наклон при установке, радианы (M.2 входит в разъём под углом 20°) */
  installTilt?: number;
}

export interface CameraPreset {
  target: Vec3;
  /** Расстояние камеры от цели */
  distance: number;
}

export interface AssemblyLayout {
  caseSpec: Extract<ModelSpec, { kind: 'case' }>;
  /** true — корпус не выбран, показан условный mid-tower */
  defaultCase: boolean;
  placements: Placement[];
  /** Где появится деталь пустого обязательного слота — красный «призрак» */
  ghosts: Partial<Record<PcComponentType, { position: Vec3; size: Vec3 }>>;
  cameras: Record<PcComponentType | 'overview', CameraPreset>;
}

const T = 0.004; // толщина стенок
const STANDOFF = 0.008; // стойки платы над поддоном

const DEFAULT_CASE = modelSpecFor({
  componentType: 'case',
  specs: {
    formFactor: 'mid-tower',
    glassPanel: true,
    dimensionsMm: { height: 470, width: 220, depth: 450 },
  },
}) as Extract<ModelSpec, { kind: 'case' }>;

const DEFAULT_BOARD = modelSpecFor({
  componentType: 'motherboard',
  specs: { formFactor: 'ATX' },
}) as Extract<ModelSpec, { kind: 'motherboard' }>;

/**
 * Места разъёмов на плате в её локальных координатах (центр платы, +X — к передней панели,
 * +Y — вверх). Ими же пользуется процедурная модель платы — разъём и деталь совпадают.
 */
export function boardFeatures(board: Extract<ModelSpec, { kind: 'motherboard' }>) {
  const [w, h] = board.size;
  const dimmPitch = 0.0095;
  return {
    socket: [-w * 0.08, h * 0.22] as [number, number],
    dimms: Array.from(
      { length: board.dimm },
      (_, i) => [w * 0.17 + i * dimmPitch, h * 0.2] as [number, number],
    ),
    pcie: Array.from(
      { length: board.pcie },
      (_, i) => [-w * 0.05, -h * 0.08 - i * 0.06] as [number, number],
    ),
    m2: Array.from(
      { length: Math.min(board.m2, 3) },
      (_, i) => [-w * 0.05, -h * 0.02 - i * 0.065 - 0.03] as [number, number],
    ),
  };
}

/** Порядок заполнения слотов памяти: два модуля — A2+B2 (двухканальный режим), как в мануалах плат. */
export function dimmFillOrder(slots: number, modules: number): number[] {
  if (slots >= 4) return modules >= 4 ? [0, 1, 2, 3] : modules >= 2 ? [1, 3] : [1];
  return modules >= 2 ? [0, 1] : [0];
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function layoutBuild(build: Build): AssemblyLayout {
  const caseSpec = build.case
    ? (modelSpecFor(build.case) as Extract<ModelSpec, { kind: 'case' }>)
    : DEFAULT_CASE;
  const [d, h, w] = caseSpec.size;
  const board = build.motherboard
    ? (modelSpecFor(build.motherboard) as Extract<ModelSpec, { kind: 'motherboard' }>)
    : DEFAULT_BOARD;
  const [bw, bh] = board.size;
  const features = boardFeatures(board);
  const placements: Placement[] = [];
  const ghosts: AssemblyLayout['ghosts'] = {};

  // Плата: верхний задний угол — за вырезом I/O, у верхней стенки; лежит на стойках поддона
  const boardZ = -w / 2 + T + STANDOFF;
  const boardCenter: Vec3 = [-d / 2 + 0.03 + bw / 2, h / 2 - 0.04 - bh / 2, boardZ];
  const onBoard = ([x, y]: [number, number], z = 0): Vec3 => [
    boardCenter[0] + x,
    boardCenter[1] + y,
    boardZ + z,
  ];

  if (build.motherboard) {
    placements.push({
      id: `motherboard:${build.motherboard.id}`,
      slot: 'motherboard',
      productId: build.motherboard.id,
      spec: board,
      position: boardCenter,
      orientation: 'board',
      size: [bw, bh, 0.02],
      installFrom: [0, 0, 0.3],
    });
  } else ghosts.motherboard = { position: boardCenter, size: [bw, bh, 0.02] };

  const socket = onBoard(features.socket, 0.004);
  if (build.cpu) {
    const spec = modelSpecFor(build.cpu) as Extract<ModelSpec, { kind: 'cpu' }>;
    placements.push({
      id: `cpu:${build.cpu.id}`,
      slot: 'cpu',
      productId: build.cpu.id,
      spec,
      position: socket,
      orientation: 'board',
      size: [spec.size[0], spec.size[1], 0.004],
      installFrom: [0, 0, 0.12],
    });
  } else ghosts.cpu = { position: socket, size: [0.04, 0.04, 0.004] };

  if (build.cooler) {
    const spec = modelSpecFor(build.cooler);
    if (spec.kind === 'cooler-aio') {
      placements.push({
        id: `cooler:${build.cooler.id}:pump`,
        slot: 'cooler',
        productId: build.cooler.id,
        spec,
        part: 'pump',
        position: add(socket, [0, 0, 0.02]),
        orientation: 'pump',
        size: [0.07, 0.07, 0.035],
        installFrom: [0, 0, 0.18],
      });
      const radLength = spec.radiator + 0.035;
      placements.push({
        id: `cooler:${build.cooler.id}:radiator`,
        slot: 'cooler',
        productId: build.cooler.id,
        spec,
        part: 'radiator',
        position: [-d / 2 + T + 0.03 + radLength / 2, h / 2 - T - spec.thickness / 2 - 0.03, 0.01],
        orientation: 'radiator-top',
        size: [radLength, spec.thickness + 0.025, spec.fanSize],
        installFrom: [0, 0.2, 0],
      });
    } else if (spec.kind === 'cooler-air') {
      placements.push({
        id: `cooler:${build.cooler.id}`,
        slot: 'cooler',
        productId: build.cooler.id,
        spec,
        position: add(socket, [0, 0, 0.006 + spec.height / 2]),
        orientation: 'tower',
        size: [spec.towers === 2 ? 0.15 : 0.12, spec.fanSize, spec.height],
        installFrom: [0, 0, 0.22],
      });
    }
  } else if (!build.cpu?.specs.includesCooler) {
    ghosts.cooler = { position: add(socket, [0, 0, 0.08]), size: [0.12, 0.12, 0.155] };
  }

  // Память: модули по порядку заполнения, каждый комплект — в свои слоты
  let dimmCursor = 0;
  const fill = dimmFillOrder(
    features.dimms.length,
    build.ram.reduce((n, l) => n + l.qty * l.product.specs.modules, 0),
  );
  for (const line of build.ram) {
    const spec = modelSpecFor(line.product) as Extract<ModelSpec, { kind: 'ram' }>;
    const modules = line.qty * spec.modules;
    for (let m = 0; m < modules; m++) {
      const slotIndex = fill[dimmCursor] ?? dimmCursor;
      dimmCursor++;
      const at = features.dimms[slotIndex] ?? features.dimms.at(-1)!;
      placements.push({
        id: `ram:${line.product.id}:${m}`,
        slot: 'ram',
        productId: line.product.id,
        spec: { ...spec, modules: 1 },
        position: onBoard(at, 0.004 + spec.height / 2),
        orientation: 'dimm',
        size: [0.007, 0.1335, spec.height],
        installFrom: [0, 0, 0.15],
      });
    }
  }
  if (build.ram.length === 0)
    ghosts.ram = {
      position: onBoard(features.dimms[1] ?? features.dimms[0]!, 0.02),
      size: [0.03, 0.1335, 0.035],
    };

  // Видеокарта: планка у задней стенки, карта в верхнем слоте PCIe, вентиляторами вниз
  const pcie = features.pcie[0]!;
  const gpuRearX = -d / 2 + 0.03;
  if (build.gpu) {
    const spec = modelSpecFor(build.gpu) as Extract<ModelSpec, { kind: 'gpu' }>;
    placements.push({
      id: `gpu:${build.gpu.id}`,
      slot: 'gpu',
      productId: build.gpu.id,
      spec,
      position: [
        gpuRearX + spec.length / 2,
        boardCenter[1] + pcie[1] - spec.thickness / 2,
        boardZ + 0.006 + spec.height / 2,
      ],
      orientation: 'gpu',
      size: [spec.length, spec.thickness, spec.height],
      installFrom: [0, 0, 0.3],
    });
  } else if (!build.cpu?.specs.integratedGraphics) {
    ghosts.gpu = {
      position: [gpuRearX + 0.15, boardCenter[1] + pcie[1] - 0.025, boardZ + 0.07],
      size: [0.3, 0.05, 0.125],
    };
  }

  // Блок питания: внизу у задней стенки, въезжает сзади вдоль +X
  if (build.psu) {
    const spec = modelSpecFor(build.psu) as Extract<ModelSpec, { kind: 'psu' }>;
    const [pl, ph, pw] = spec.size;
    placements.push({
      id: `psu:${build.psu.id}`,
      slot: 'psu',
      productId: build.psu.id,
      spec,
      position: [
        -d / 2 + T + 0.008 + pl / 2,
        -h / 2 + T + 0.006 + ph / 2,
        -w / 2 + T + pw / 2 + 0.01,
      ],
      orientation: 'psu',
      size: [pl, ph, pw],
      installFrom: [-0.3, 0, 0],
    });
  } else ghosts.psu = { position: [-d / 2 + 0.09, -h / 2 + 0.05, 0], size: [0.16, 0.086, 0.15] };

  // Накопители: NVMe — в разъёмы M.2 платы, SATA — в отсеки у передней стенки
  let m2Cursor = 0;
  let bay25 = 0;
  let bay35 = 0;
  for (const line of build.storage) {
    const spec = modelSpecFor(line.product) as Extract<ModelSpec, { kind: 'storage' }>;
    for (let i = 0; i < line.qty; i++) {
      const id = `storage:${line.product.id}:${i}`;
      if (spec.form === 'm2') {
        const at = features.m2[m2Cursor] ?? features.m2.at(-1)!;
        m2Cursor++;
        placements.push({
          id,
          slot: 'storage',
          productId: line.product.id,
          spec,
          position: onBoard(at, 0.006),
          orientation: 'board',
          size: [0.08, 0.022, spec.heatsink ? 0.01 : 0.003],
          installFrom: [-0.08, 0, 0.06],
          installTilt: (20 * Math.PI) / 180,
        });
      } else if (spec.form === '2.5') {
        placements.push({
          id,
          slot: 'storage',
          productId: line.product.id,
          spec,
          position: [d / 2 - T - 0.07, -h / 2 + T + 0.11 + bay25 * 0.012, 0],
          orientation: 'flat',
          size: [0.1, 0.007, 0.07],
          installFrom: [0.2, 0, 0],
        });
        bay25++;
      } else {
        placements.push({
          id,
          slot: 'storage',
          productId: line.product.id,
          spec,
          position: [d / 2 - T - 0.09, -h / 2 + T + 0.02 + bay35 * 0.032, 0],
          orientation: 'flat',
          size: [0.147, 0.026, 0.1016],
          installFrom: [0.25, 0, 0],
        });
        bay35++;
      }
    }
  }
  if (build.storage.length === 0) {
    ghosts.storage = {
      position: onBoard(features.m2[0] ?? [0, 0], 0.006),
      size: [0.08, 0.022, 0.003],
    };
  }

  // Вентиляторы: сначала передняя стенка, затем верх (если там нет радиатора), затем тыл
  const topTaken = placements.some((p) => p.part === 'radiator');
  const fanSlots: { position: Vec3; orientation: Orientation; installFrom: Vec3 }[] = [];
  const frontX = d / 2 - T - 0.016;
  for (let i = 0; i < 3; i++) {
    fanSlots.push({
      position: [frontX, h / 2 - 0.1 - i * 0.135, 0.005],
      orientation: 'fan-front',
      installFrom: [0.2, 0, 0],
    });
  }
  if (!topTaken) {
    for (let i = 0; i < 2; i++) {
      fanSlots.push({
        position: [-d / 2 + 0.11 + i * 0.135, h / 2 - T - 0.016, 0.005],
        orientation: 'fan-top',
        installFrom: [0, 0.2, 0],
      });
    }
  }
  fanSlots.push({
    position: [-d / 2 + T + 0.016, h / 2 - 0.1, 0.005],
    orientation: 'fan-rear',
    installFrom: [-0.2, 0, 0],
  });

  let fanCursor = 0;
  for (const line of build.case_fan) {
    const spec = modelSpecFor(line.product) as Extract<ModelSpec, { kind: 'fan' }>;
    for (let i = 0; i < line.qty * spec.count && fanCursor < fanSlots.length; i++) {
      const slot = fanSlots[fanCursor++]!;
      placements.push({
        id: `case_fan:${line.product.id}:${i}`,
        slot: 'case_fan',
        productId: line.product.id,
        spec: { ...spec, count: 1 },
        position: slot.position,
        orientation: slot.orientation,
        size:
          slot.orientation === 'fan-top'
            ? [spec.size, 0.025, spec.size]
            : [0.025, spec.size, spec.size],
        installFrom: slot.installFrom,
      });
    }
  }

  // Камеры: обзор всего корпуса и крупный план каждого слота
  const caseRadius = Math.hypot(d, h, w) / 2;
  const cameras = {
    overview: { target: [0, 0, 0] as Vec3, distance: caseRadius * 2.4 },
  } as AssemblyLayout['cameras'];
  const slots: PcComponentType[] = [
    'case',
    'motherboard',
    'cpu',
    'cooler',
    'ram',
    'gpu',
    'storage',
    'psu',
    'case_fan',
  ];
  for (const slot of slots) {
    const parts = placements.filter((p) => p.slot === slot);
    const ghost = ghosts[slot];
    if (slot === 'case' || (parts.length === 0 && !ghost)) {
      cameras[slot] = cameras.overview;
      continue;
    }
    const boxes =
      parts.length > 0 ? parts.map((p) => ({ position: p.position, size: p.size })) : [ghost!];
    const min = [0, 1, 2].map((a) =>
      Math.min(...boxes.map((b) => b.position[a]! - b.size[a]! / 2)),
    );
    const max = [0, 1, 2].map((a) =>
      Math.max(...boxes.map((b) => b.position[a]! + b.size[a]! / 2)),
    );
    const target = [0, 1, 2].map((a) => (min[a]! + max[a]!) / 2) as Vec3;
    const radius = Math.hypot(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!) / 2;
    cameras[slot] = { target, distance: Math.max(radius * 3.2, 0.25) };
  }

  return { caseSpec, defaultCase: !build.case, placements, ghosts, cameras };
}

/** Деталь целиком внутри корпуса (с допуском) — сцена подсвечивает торчащие наружу. */
export function fitsInCase(
  layout: AssemblyLayout,
  placement: Placement,
  tolerance = 0.002,
): boolean {
  const [d, h, w] = layout.caseSpec.size;
  const half: Vec3 = [d / 2, h / 2, w / 2];
  return [0, 1, 2].every(
    (a) =>
      placement.position[a]! - placement.size[a]! / 2 >= -half[a]! - tolerance &&
      placement.position[a]! + placement.size[a]! / 2 <= half[a]! + tolerance,
  );
}
