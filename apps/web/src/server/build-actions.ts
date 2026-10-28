'use server';

import { getDb } from '@redcore/db';
import { BuildValidationError, saveBuild, trackEvent, type BuildInput } from '@redcore/services';
import { z } from 'zod';
import { getSession } from './auth';
import { getPerf, getSnapshot } from './catalog';

export type SaveBuildResult =
  { ok: true; publicId: string } | { ok: false; error: 'invalid' | 'failed' };

/**
 * Сохранение сборки из конфигуратора. Клиент присылает только slug и количество —
 * цены, состав и совместимость сервер пересчитывает сам тем же движком, что и в браузере.
 */
export async function saveBuildAction(input: BuildInput): Promise<SaveBuildResult> {
  try {
    // Slug одинаковы для всех языков, поэтому достаточно одного снимка
    const [db, snapshot, perf, session] = await Promise.all([
      getDb(),
      getSnapshot('ru'),
      getPerf(),
      getSession(),
    ]);
    const saved = await saveBuild(
      db,
      snapshot,
      perf,
      { ...input, source: 'manual' },
      session?.user.id ?? null,
    );
    return { ok: true, publicId: saved.publicId };
  } catch (error) {
    if (error instanceof BuildValidationError) return { ok: false, error: 'invalid' };
    console.error('saveBuildAction failed', error);
    return { ok: false, error: 'failed' };
  }
}

const eventSchema = z.object({
  type: z.enum(['configurator_view', 'build_to_cart', 'build_shared']),
  lines: z.number().int().min(0).max(50).optional(),
  publicId: z
    .string()
    .regex(/^[0-9A-Za-z]{6,20}$/)
    .optional(),
});

/** События воронки конфигуратора. Ошибки аналитики не должны мешать покупателю. */
export async function trackBuildEventAction(event: z.input<typeof eventSchema>): Promise<void> {
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) return;
  const { type, ...payload } = parsed.data;
  try {
    await trackEvent(await getDb(), type, payload);
  } catch (error) {
    console.error('trackBuildEventAction failed', error);
  }
}
