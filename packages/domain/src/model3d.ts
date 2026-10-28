import type { ComponentType } from './specs/enums';

// Параметры 3D-модели товара из его характеристик. Единицы — метры, +Y вверх.
// Одна базовая модель на подтип плюс параметры: длина видеокарты, высота кулера, габариты
// корпуса берутся из тех же полей, что проверяет движок совместимости.

export const MM = 0.001;

/** Цвета исполнения → базовый цвет материала (sRGB). */
export const finishColors = {
  black: '#16161a',
  white: '#e6e7ea',
  silver: '#b8bcc3',
  gray: '#585b62',
  red: '#b0121b',
  pink: '#e391b2',
} as const;
export type Finish = keyof typeof finishColors;

/** Цвет RGB-подсветки по умолчанию — Rosso Corsa на тёмном фоне. */
export const DEFAULT_RGB = '#ff2800';

interface Common {
  finish: Finish;
  rgb: boolean;
  /**
   * Ключ базовой GLB из манифеста tooling/3d. Если файла нет (модели не скачаны),
   * сцена строит процедурную модель по тем же параметрам.
   */
  glbKey: string | null;
}

export type ModelSpec =
  | (Common & { kind: 'case'; size: [number, number, number]; glass: boolean; formFactor: string })
  | (Common & {
      kind: 'motherboard';
      size: [number, number];
      dimm: number;
      m2: number;
      pcie: number;
      formFactor: string;
    })
  | (Common & { kind: 'cpu'; size: [number, number]; socket: string; vendor: 'amd' | 'intel' })
  | (Common & { kind: 'gpu'; length: number; height: number; thickness: number; fans: number })
  | (Common & {
      kind: 'cooler-air';
      height: number;
      fans: number;
      fanSize: number;
      towers: 1 | 2;
      lowProfile: boolean;
    })
  | (Common & {
      kind: 'cooler-aio';
      radiator: number;
      thickness: number;
      fans: number;
      fanSize: number;
      display: boolean;
    })
  | (Common & { kind: 'ram'; height: number; modules: number })
  | (Common & { kind: 'storage'; form: 'm2' | '2.5' | '3.5'; heatsink: boolean })
  | (Common & { kind: 'psu'; size: [number, number, number] })
  | (Common & { kind: 'fan'; size: number; count: number })
  | (Common & { kind: 'monitor'; diagonal: number; aspect: number; curved: boolean })
  | (Common & { kind: 'keyboard'; width: number })
  | (Common & { kind: 'mouse'; length: number })
  | (Common & { kind: 'headset' })
  | (Common & { kind: 'mousepad'; size: [number, number]; thickness: number })
  | (Common & { kind: 'webcam' });

export type ModelKind = ModelSpec['kind'];

type Specs = Record<string, unknown>;
const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const bool = (v: unknown) => v === true;
const finishOf = (v: unknown): Finish =>
  typeof v === 'string' && v in finishColors ? (v as Finish) : 'black';

const boardSizes: Record<string, [number, number]> = {
  'E-ATX': [305, 330],
  ATX: [305, 244],
  mATX: [244, 244],
  'Mini-ITX': [170, 170],
};

const keyboardWidths: Record<string, number> = {
  full: 440,
  tkl: 360,
  '75': 320,
  '65': 310,
  '60': 290,
};

/** Слот расширения PCIe — 20,32 мм. */
const SLOT_MM = 20.32;

export function modelSpecFor(product: { componentType: ComponentType; specs: unknown }): ModelSpec {
  const s = (product.specs ?? {}) as Specs;
  const finish = finishOf(s.color);
  switch (product.componentType) {
    case 'case': {
      const d = (s.dimensionsMm ?? {}) as { height?: number; width?: number; depth?: number };
      const form = String(s.formFactor ?? 'mid-tower');
      return {
        kind: 'case',
        finish,
        rgb: false,
        glass: bool(s.glassPanel),
        formFactor: form,
        // Стандартный mid-tower по манифесту; остальные — процедурные по габаритам
        glbKey: form === 'mid-tower' && bool(s.glassPanel) ? 'case_atx' : null,
        size: [num(d.depth, 450) * MM, num(d.height, 470) * MM, num(d.width, 220) * MM],
      };
    }
    case 'motherboard': {
      const form = String(s.formFactor ?? 'ATX');
      const [h, w] = boardSizes[form] ?? boardSizes.ATX!;
      return {
        kind: 'motherboard',
        finish,
        rgb: false,
        formFactor: form,
        glbKey: form === 'ATX' ? 'mb_atx' : null,
        size: [w * MM, h * MM],
        dimm: num(s.memorySlots, 4),
        m2: num(s.m2Slots, 2),
        pcie: Math.max(1, num(s.pcieX16Slots, 1)),
      };
    }
    case 'cpu': {
      const socket = String(s.socket ?? 'AM5');
      const intel = socket.startsWith('LGA');
      return {
        kind: 'cpu',
        finish: 'silver',
        rgb: false,
        socket,
        vendor: intel ? 'intel' : 'amd',
        glbKey: socket === 'AM5' ? 'cpu_am5' : socket === 'AM4' ? 'cpu_am4' : 'cpu_intel',
        size: intel ? [45 * MM, 37.5 * MM] : [40 * MM, 40 * MM],
      };
    }
    case 'gpu': {
      const fans = Math.min(3, Math.max(1, num(s.fans, 3)));
      return {
        kind: 'gpu',
        finish,
        rgb: bool(s.rgb),
        glbKey: fans >= 3 ? 'gpu_3fan' : 'gpu_2fan',
        length: num(s.lengthMm, 300) * MM,
        height: (fans >= 3 ? 137 : 125) * MM,
        thickness: num(s.slotWidth, 2.5) * SLOT_MM * MM,
        fans,
      };
    }
    case 'cooler': {
      if (s.kind === 'aio') {
        return {
          kind: 'cooler-aio',
          finish,
          rgb: bool(s.rgb),
          glbKey: null,
          radiator: num(s.radiatorMm, 360) * MM,
          thickness: num(s.radiatorThicknessMm, 27) * MM,
          fans: num(s.fans, 3),
          fanSize: num(s.fanSizeMm, 120) * MM,
          display: bool(s.pumpDisplay),
        };
      }
      const height = num(s.heightMm, 155);
      const fans = num(s.fans, 1);
      return {
        kind: 'cooler-air',
        finish,
        rgb: bool(s.rgb),
        glbKey: null,
        height: height * MM,
        fans: Math.max(1, fans),
        fanSize: num(s.fanSizeMm, 120) * MM,
        // Две башни у больших кулеров с двумя вентиляторами (NH-D15, Peerless Assassin)
        towers: fans >= 2 && height >= 154 ? 2 : 1,
        lowProfile: bool(s.lowProfile),
      };
    }
    case 'ram':
      return {
        kind: 'ram',
        finish,
        rgb: bool(s.rgb),
        glbKey: bool(s.rgb) ? 'ram_rgb' : num(s.heightMm, 34) <= 35 ? 'ram_lowprofile' : null,
        height: num(s.heightMm, 34) * MM,
        modules: Math.max(1, num(s.modules, 2)),
      };
    case 'storage': {
      const form = s.formFactor === '2.5' ? '2.5' : s.formFactor === '3.5' ? '3.5' : 'm2';
      return {
        kind: 'storage',
        finish: 'black',
        rgb: false,
        form,
        heatsink: bool(s.heatsink),
        glbKey: form === 'm2' ? 'ssd_m2' : form === '2.5' ? 'ssd_25' : 'hdd_35',
      };
    }
    case 'psu': {
      const form = String(s.formFactor ?? 'ATX');
      const size: [number, number, number] =
        form === 'ATX'
          ? [num(s.lengthMm, 160) * MM, 86 * MM, 150 * MM]
          : [(form === 'SFX-L' ? 130 : 100) * MM, 63.5 * MM, 125 * MM];
      return { kind: 'psu', finish, rgb: false, size, glbKey: form === 'ATX' ? 'psu_atx' : null };
    }
    case 'case_fan':
      return {
        kind: 'fan',
        finish,
        rgb: s.lighting === 'rgb' || s.lighting === 'argb',
        glbKey: 'fan_120',
        size: num(s.sizeMm, 120) * MM,
        count: Math.min(3, Math.max(1, num(s.packCount, 1))),
      };
    case 'monitor': {
      const res = (s.resolution ?? {}) as { width?: number; height?: number };
      return {
        kind: 'monitor',
        finish: 'black',
        rgb: false,
        glbKey: null,
        diagonal: num(s.sizeInch, 27) * 25.4 * MM,
        aspect: num(res.width, 2560) / num(res.height, 1440),
        curved: bool(s.curved),
      };
    }
    case 'keyboard':
      return {
        kind: 'keyboard',
        finish: 'black',
        rgb: bool(s.rgb),
        glbKey: null,
        width: (keyboardWidths[String(s.formFactor)] ?? 440) * MM,
      };
    case 'mouse':
      return {
        kind: 'mouse',
        finish: 'black',
        rgb: bool(s.rgb),
        glbKey: null,
        length: num(s.weightG, 70) < 60 ? 0.118 : 0.126,
      };
    case 'headset':
      return { kind: 'headset', finish: 'black', rgb: false, glbKey: null };
    case 'mousepad':
      return {
        kind: 'mousepad',
        finish: 'black',
        rgb: bool(s.rgb),
        glbKey: null,
        size: [num(s.widthMm, 450) * MM, num(s.heightMm, 400) * MM],
        thickness: num(s.thicknessMm, 3) * MM,
      };
    case 'webcam':
      return { kind: 'webcam', finish: 'black', rgb: false, glbKey: null };
    default:
      // Готовая сборка показывается корпусом (полная сцена сборки — на этапе 7)
      return {
        kind: 'case',
        finish: 'black',
        rgb: true,
        glass: true,
        formFactor: 'mid-tower',
        glbKey: null,
        size: [450 * MM, 470 * MM, 220 * MM],
      };
  }
}

/** Наибольший габарит модели — по нему камера подбирает расстояние. */
export function modelExtent(spec: ModelSpec): number {
  switch (spec.kind) {
    case 'case':
    case 'psu':
      return Math.max(...spec.size);
    case 'motherboard':
      return Math.max(...spec.size);
    case 'cpu':
      return Math.max(...spec.size);
    case 'gpu':
      return spec.length;
    case 'cooler-air':
      return Math.max(spec.height, spec.fanSize * 1.1);
    case 'cooler-aio':
      return spec.radiator + 0.04;
    case 'ram':
      return 0.133;
    case 'storage':
      return spec.form === 'm2' ? 0.08 : spec.form === '2.5' ? 0.1 : 0.147;
    case 'fan':
      return spec.size * spec.count;
    case 'monitor':
      return spec.diagonal;
    case 'keyboard':
      return spec.width;
    case 'mouse':
      return spec.length;
    case 'mousepad':
      return Math.max(...spec.size);
    case 'headset':
      return 0.2;
    case 'webcam':
      return 0.1;
  }
}
