import type { Uzs } from './money';
import type { ComponentType, GpuVendor, PcComponentType } from './specs/enums';
import type { SpecsOf } from './specs/schemas';

/** Товар каталога в том виде, в каком его видит доменная логика. */
export interface CatalogProduct<T extends ComponentType = ComponentType> {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  componentType: T;
  priceUzs: Uzs;
  stockQty: number;
  specs: SpecsOf<T>;
  /** Ключ в perf_cpu (для CPU) или perf_gpu (для GPU — совпадает со specs.chip) */
  perfKey?: string | null;
}

export type AnyCatalogProduct = { [T in ComponentType]: CatalogProduct<T> }[ComponentType];

export function isOfType<T extends ComponentType>(
  product: AnyCatalogProduct,
  type: T,
): product is Extract<AnyCatalogProduct, { componentType: T }> {
  return product.componentType === type;
}

// ── Индексы производительности (эталон: RTX 5070 = 1.00, Ryzen 7 9800X3D = 1.00) ──

export interface GpuPerf {
  key: string;
  name: string;
  vendor: GpuVendor;
  index1080: number;
  index1440: number;
  index2160: number;
  frameGen: 'none' | 'fg' | 'mfg';
  /** Видеопамять типовой карты на этом чипе — для калькулятора FPS без конкретного товара */
  vramGb?: number;
}

export interface CpuPerf {
  key: string;
  name: string;
  gamingIndex: number;
  multiThreadIndex: number;
}

export interface PerfIndex {
  gpu: Record<string, GpuPerf>;
  cpu: Record<string, CpuPerf>;
}

export type Resolution = '1080p' | '1440p' | '2160p';

export function gpuIndexFor(perf: GpuPerf, resolution: Resolution): number {
  if (resolution === '1080p') return perf.index1080;
  if (resolution === '2160p') return perf.index2160;
  return perf.index1440;
}

// ── Сборка ──

export interface BuildLine<T extends 'ram' | 'storage' | 'case_fan'> {
  product: CatalogProduct<T>;
  qty: number;
}

/** Слоты с одной деталью и слоты-списки (память, накопители, вентиляторы). */
export interface Build {
  case?: CatalogProduct<'case'>;
  motherboard?: CatalogProduct<'motherboard'>;
  cpu?: CatalogProduct<'cpu'>;
  cooler?: CatalogProduct<'cooler'>;
  gpu?: CatalogProduct<'gpu'>;
  psu?: CatalogProduct<'psu'>;
  ram: BuildLine<'ram'>[];
  storage: BuildLine<'storage'>[];
  case_fan: BuildLine<'case_fan'>[];
}

export type SingleSlot = 'case' | 'motherboard' | 'cpu' | 'cooler' | 'gpu' | 'psu';
export type ListSlot = 'ram' | 'storage' | 'case_fan';

export const singleSlots = ['case', 'motherboard', 'cpu', 'cooler', 'gpu', 'psu'] as const;
export const listSlots = ['ram', 'storage', 'case_fan'] as const;

export function isListSlot(slot: PcComponentType): slot is ListSlot {
  return (listSlots as readonly string[]).includes(slot);
}

export function emptyBuild(): Build {
  return { ram: [], storage: [], case_fan: [] };
}

/** Плоский список позиций сборки: для итоговой суммы, корзины и PDF. */
export function buildLines(build: Build): { product: AnyCatalogProduct; qty: number }[] {
  const lines: { product: AnyCatalogProduct; qty: number }[] = [];
  for (const slot of singleSlots) {
    const product = build[slot];
    if (product) lines.push({ product: product as AnyCatalogProduct, qty: 1 });
  }
  for (const slot of listSlots) {
    for (const line of build[slot])
      lines.push({ product: line.product as AnyCatalogProduct, qty: line.qty });
  }
  return lines;
}

export function buildTotalUzs(build: Build): Uzs {
  return buildLines(build).reduce((sum, line) => sum + line.product.priceUzs * line.qty, 0);
}

/**
 * Ставит товар в его слот (неизменяемо). Одиночные слоты и память заменяются,
 * накопители и вентиляторы — добавляются (одинаковый товар увеличивает количество).
 */
export function placeProduct(build: Build, product: AnyCatalogProduct, qty = 1): Build {
  const next: Build = {
    ...build,
    ram: [...build.ram],
    storage: [...build.storage],
    case_fan: [...build.case_fan],
  };
  switch (product.componentType) {
    case 'case':
    case 'motherboard':
    case 'cpu':
    case 'cooler':
    case 'gpu':
    case 'psu':
      return { ...next, [product.componentType]: product };
    case 'ram':
      return { ...next, ram: [{ product, qty }] };
    case 'storage':
    case 'case_fan': {
      const slot = product.componentType;
      const lines = next[slot] as BuildLine<typeof slot>[];
      const existing = lines.findIndex((line) => line.product.id === product.id);
      if (existing >= 0) {
        const line = lines[existing]!;
        lines[existing] = { ...line, qty: line.qty + qty };
      } else {
        lines.push({ product, qty } as BuildLine<typeof slot>);
      }
      return { ...next, [slot]: lines };
    }
    default:
      throw new Error(`${product.componentType} cannot be placed into a PC build`);
  }
}

export function removeFromSlot(build: Build, slot: PcComponentType, productId?: string): Build {
  if (isListSlot(slot)) {
    return {
      ...build,
      [slot]: productId ? build[slot].filter((line) => line.product.id !== productId) : [],
    };
  }
  const next = { ...build };
  delete next[slot];
  return next;
}
