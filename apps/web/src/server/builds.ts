import 'server-only';
import { getDb } from '@redcore/db';
import type { Locale } from '@redcore/i18n';
import { getSavedBuild } from '@redcore/services';
import { cache } from 'react';
import { getPerf, getSnapshot } from './catalog';

/** Сохранённая сборка с текущими ценами. Один запрос к БД на рендер (React cache). */
export const loadSavedBuild = cache(async (locale: Locale, publicId: string, countView = false) => {
  const [db, snapshot, perf] = await Promise.all([getDb(), getSnapshot(locale), getPerf()]);
  return getSavedBuild(db, snapshot, perf, publicId, { countView });
});
