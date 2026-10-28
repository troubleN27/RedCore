import {
  buildSearchText,
  checkBuild,
  emptyBuild,
  parseSpecs,
  placeProduct,
  type AnyCatalogProduct,
  type ComponentType,
  type PerfIndex,
} from '@redcore/domain';
import type { Locale } from '@redcore/i18n';
import { categories } from './data/categories';
import { cpus } from './data/cpus';
import { gpus } from './data/gpus';
import { memory, storage } from './data/memory-storage';
import { motherboards } from './data/motherboards';
import { cpuPerf, gpuPerf } from './data/perf';
import { headsets, keyboards, mice, monitors, mousepads, webcams } from './data/peripherals';
import { caseFans, cases, coolers, powerSupplies } from './data/power-cases-cooling';
import { prebuilts } from './data/prebuilts';
import type { ProductSeed } from './data/types';
import { describe, describePrebuilt } from './descriptions';
import { prebuiltPriceUzs, seedRate, stockFor, usdToUzs } from './pricing';

export type SeedProduct = AnyCatalogProduct & {
  categorySlug: string;
  compareAtPriceUzs: number | null;
  warrantyMonths: number;
  featured: boolean;
  shortDescription: Record<Locale, string>;
  /** Только у готовых сборок: slug компонентов */
  components?: { slug: string; qty: number }[];
};

const skuPrefix: Record<ComponentType, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  motherboard: 'MB',
  ram: 'RAM',
  storage: 'SSD',
  psu: 'PSU',
  case: 'CASE',
  cooler: 'COOL',
  case_fan: 'FAN',
  monitor: 'MON',
  keyboard: 'KB',
  mouse: 'MS',
  headset: 'HS',
  mousepad: 'PAD',
  webcam: 'CAM',
  prebuilt: 'PC',
};

const warranty: Record<ComponentType, number> = {
  cpu: 36,
  gpu: 36,
  motherboard: 36,
  ram: 60,
  storage: 60,
  psu: 60,
  case: 24,
  cooler: 36,
  case_fan: 24,
  monitor: 36,
  keyboard: 24,
  mouse: 24,
  headset: 24,
  mousepad: 12,
  webcam: 24,
  prebuilt: 24,
};

/** «ASUS TUF Gaming B850-Plus WiFi» → «asus-tuf-gaming-b850-plus-wifi» */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const productKey = (brand: string, name: string) => `${brand} ${name}`;

const categoryByType = new Map(categories.map((c) => [c.type, c.slug]));

const ASSEMBLY_UZS = 350_000;
const PREBUILT_MAX_STOCK = 5;

export const seedLists: ProductSeed[][] = [
  cpus,
  gpus,
  motherboards,
  memory,
  storage,
  powerSupplies,
  cases,
  coolers,
  caseFans,
  monitors,
  keyboards,
  mice,
  headsets,
  mousepads,
  webcams,
];

export function buildPerfIndex(): PerfIndex {
  return {
    gpu: Object.fromEntries(gpuPerf.map((g) => [g.key, g])),
    cpu: Object.fromEntries(cpuPerf.map((c) => [c.key, c])),
  };
}

/**
 * Каталог демо-данных целиком: характеристики проверены Zod, цены пересчитаны в сумы,
 * готовые сборки прошли проверку совместимости. id = slug (в БД будет uuid).
 */
export function buildSeedCatalog(rate = seedRate()): { products: SeedProduct[]; perf: PerfIndex } {
  const perf = buildPerfIndex();
  const counters = new Map<ComponentType, number>();
  const nextSku = (type: ComponentType) => {
    const value = (counters.get(type) ?? 0) + 1;
    counters.set(type, value);
    return `RC-${skuPrefix[type]}-${String(value).padStart(3, '0')}`;
  };

  const result: SeedProduct[] = [];
  const byKey = new Map<string, SeedProduct>();

  for (const item of seedLists.flat()) {
    const slug = slugify(productKey(item.brand, item.name));
    const specs = parseSpecs(item.type, item.specs);
    const base = {
      id: slug,
      sku: nextSku(item.type),
      slug,
      name: item.name,
      brand: item.brand,
      componentType: item.type,
      priceUzs: usdToUzs(item.usd, rate),
      stockQty: item.stock ?? stockFor(slug),
      specs,
      perfKey: item.type === 'gpu' ? (specs as { chip: string }).chip : (item.perfKey ?? null),
    } as AnyCatalogProduct;
    const product: SeedProduct = {
      ...base,
      categorySlug: categoryByType.get(item.type)!,
      compareAtPriceUzs: item.compareAtUsd ? usdToUzs(item.compareAtUsd, rate) : null,
      warrantyMonths: item.warrantyMonths ?? warranty[item.type],
      featured: item.featured ?? false,
      shortDescription: { ru: describe(base, 'ru'), uz: describe(base, 'uz') },
    };
    result.push(product);
    byKey.set(productKey(item.brand, item.name), product);
  }

  for (const prebuilt of prebuilts) {
    const components = prebuilt.components.map((key) => {
      const found = byKey.get(key);
      if (!found) throw new Error(`Prebuilt "${prebuilt.name}": component not found — ${key}`);
      return found;
    });
    const build = components.reduce((acc, part) => placeProduct(acc, part), emptyBuild());
    const check = checkBuild(build, perf);
    const errors = check.issues.filter((i) => i.severity === 'error').map((i) => i.code);
    if (errors.length > 0 || check.missing.length > 0) {
      throw new Error(
        `Prebuilt "${prebuilt.name}" is not compatible: ${[...errors, ...check.missing].join(', ')}`,
      );
    }
    const name = `RedCore ${prebuilt.name}`;
    const slug = slugify(name);
    const product = {
      id: slug,
      sku: nextSku('prebuilt'),
      slug,
      name,
      brand: 'RedCore',
      componentType: 'prebuilt',
      priceUzs: prebuiltPriceUzs(check.totalUzs, ASSEMBLY_UZS),
      stockQty: Math.min(PREBUILT_MAX_STOCK, ...components.map((c) => c.stockQty)),
      specs: parseSpecs('prebuilt', prebuilt.specs),
      perfKey: null,
      categorySlug: categoryByType.get('prebuilt')!,
      compareAtPriceUzs: null,
      warrantyMonths: warranty.prebuilt,
      featured: prebuilt.featured ?? false,
      shortDescription: {
        ru: describePrebuilt(components, 'ru'),
        uz: describePrebuilt(components, 'uz'),
      },
      components: components.map((c) => ({ slug: c.slug, qty: 1 })),
    } satisfies SeedProduct;
    result.push(product);
  }

  return { products: result, perf };
}

const categoryNames = new Map(categories.map((c) => [c.slug, [c.ru.name, c.uz.name]]));

/** Ключевые характеристики, по которым ищут: «AM5», «DDR5», «rtx 5070», «B850»… */
function specKeywords(product: SeedProduct): string[] {
  const s = product.specs as Record<string, unknown>;
  const keys = [
    'socket',
    'family',
    'chip',
    'vendor',
    'chipset',
    'formFactor',
    'memoryType',
    'type',
    'interface',
    'kind',
    'panel',
    'efficiency',
  ];
  return keys
    .map((key) => s[key])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.replace(/-/g, ' '));
}

export function searchTextFor(product: SeedProduct): string {
  return buildSearchText({
    brand: product.brand,
    name: product.name,
    sku: product.sku,
    keywords: [...(categoryNames.get(product.categorySlug) ?? []), ...specKeywords(product)],
  });
}
