'use client';

import {
  checkBuild,
  emptyBuild,
  placeProduct,
  type Build,
  type CompatResult,
  type PcComponentType,
  type PerfIndex,
} from '@redcore/domain';
import { useMemo } from 'react';
import { useConfiguratorStore } from '@/stores/configurator-store';
import { useStoreHydrated } from '@/stores/store-hydrator';
import { stepOrder, type BuildItem, type ConfigProduct } from './types';

export interface BuildLineState {
  slot: PcComponentType;
  product: ConfigProduct;
  qty: number;
}

export interface BuildState {
  items: BuildItem[];
  build: Build;
  lines: BuildLineState[];
  check: CompatResult;
  /** Слоты, обязательные при текущем выборе (кулер и видеокарта зависят от процессора) */
  required: Set<PcComponentType>;
}

const EMPTY: BuildItem[] = [];

/**
 * Сборка из черновика: товары берутся из каталога по slug, совместимость
 * считается тем же движком, что и на сервере, — на каждое изменение.
 */
export function useBuild(products: ConfigProduct[], perf: PerfIndex): BuildState {
  const hydrated = useStoreHydrated();
  const storeItems = useConfiguratorStore((s) => s.items);
  // До гидрации — пустая сборка, как в серверной разметке
  const items = hydrated ? storeItems : EMPTY;
  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);

  return useMemo(() => {
    let build = emptyBuild();
    const lines: BuildLineState[] = [];
    for (const item of items) {
      const product = bySlug.get(item.slug);
      // Товар сняли с продажи — тихо пропускаем
      if (!product || product.componentType !== item.slot) continue;
      build = placeProduct(build, product, item.qty);
      lines.push({ slot: item.slot, product, qty: item.qty });
    }
    lines.sort((a, b) => stepOrder.indexOf(a.slot) - stepOrder.indexOf(b.slot));
    const check = checkBuild(build, perf);
    const required = new Set<PcComponentType>([
      'case',
      'motherboard',
      'cpu',
      'ram',
      'storage',
      'psu',
    ]);
    if (!build.cpu?.specs.includesCooler) required.add('cooler');
    if (!build.cpu?.specs.integratedGraphics) required.add('gpu');
    return { items, build, lines, check, required };
  }, [items, bySlug, perf]);
}
