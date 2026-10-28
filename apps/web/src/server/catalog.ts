import 'server-only';
import { getDb } from '@redcore/db';
import type { Locale } from '@redcore/i18n';
import { getCatalogSnapshot, getPerfIndex } from '@redcore/services';
import { cache } from 'react';

// Доступ к каталогу из серверных компонентов: снимок общий на запрос (React cache),
// а между запросами кэшируется в сервисе (TTL 60 с).

export const getSnapshot = cache(async (locale: Locale) =>
  getCatalogSnapshot(await getDb(), locale),
);

export const getPerf = cache(async () => getPerfIndex(await getDb()));

/** Человеческие названия видеочипов для фильтров и характеристик: rtx-5070 → GeForce RTX 5070. */
export const getChipNames = cache(async (): Promise<Record<string, string>> => {
  const perf = await getPerf();
  return Object.fromEntries(Object.values(perf.gpu).map((g) => [g.key, g.name]));
});
