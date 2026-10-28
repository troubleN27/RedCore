import 'server-only';
import { getDb } from '@redcore/db';
import type { Locale } from '@redcore/i18n';
import { getFpsData } from '@redcore/services';
import { cache } from 'react';
import type { FpsPageData, PartLookup } from '@/features/fps/types';
import { getSnapshot } from './catalog';

// Данные калькулятора FPS для страницы /fps и панели конфигуратора. Кэш сервиса — 60 с и
// сбрасывается правками в консоли, поэтому новая игра появляется сразу.

export const getFps = cache(async (): Promise<Omit<FpsPageData, 'parts'>> => {
  const data = await getFpsData(await getDb());
  return {
    games: data.games.map(({ isActive: _active, sort: _sort, id: _id, ...game }) => game),
    gpus: data.gpus,
    cpus: data.cpus,
    model: data.model,
  };
});

/** Карточки товаров → ключи индексов: «Из моей сборки» на /fps по slug из черновика. */
export const getPartLookup = cache(async (locale: Locale): Promise<PartLookup> => {
  const snapshot = await getSnapshot(locale);
  const lookup: PartLookup = { gpu: {}, cpu: {}, ram: {} };
  for (const p of snapshot.products) {
    const specs = p.specs as Record<string, unknown>;
    if (p.componentType === 'gpu')
      lookup.gpu[p.slug] = { key: String(specs.chip), vramGb: Number(specs.vramGb) };
    else if (p.componentType === 'cpu' && p.perfKey) lookup.cpu[p.slug] = p.perfKey;
    else if (p.componentType === 'ram')
      lookup.ram[p.slug] = {
        capacityGb: Number(specs.capacityGb),
        modules: Number(specs.modules),
        type: specs.type as 'DDR4' | 'DDR5',
        speedMts: Number(specs.speedMts),
      };
  }
  return lookup;
});
