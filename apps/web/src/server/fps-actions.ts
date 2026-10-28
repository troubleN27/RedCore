'use server';

import { getDb } from '@redcore/db';
import {
  buildLines,
  pcComponentTypes,
  presets,
  resolutions,
  reverseFps,
  upscaleModes,
  upscalers,
  type PcComponentType,
} from '@redcore/domain';
import { getFpsData } from '@redcore/services';
import { z } from 'zod';
import type { ReverseActionResult } from '@/features/fps/types';
import { getPerf, getSnapshot } from './catalog';

const reverseSchema = z.object({
  game: z.string().min(1).max(80),
  target: z.number().int().min(20).max(1000),
  resolution: z.enum(resolutions),
  preset: z.enum(presets),
  upscale: z.enum(upscaleModes),
  upscaler: z.enum(upscalers).optional(),
});

const slots = new Set<string>(pcComponentTypes);

/**
 * «Хочу N FPS»: подбор считается на сервере по актуальным остаткам — в браузер уходят
 * только итоговые сборки (slug и количество), которые можно открыть в конфигураторе.
 */
export async function reverseFpsAction(
  input: z.input<typeof reverseSchema>,
): Promise<ReverseActionResult> {
  const parsed = reverseSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  try {
    const { game: slug, target, ...settings } = parsed.data;
    const [data, snapshot, perf] = await Promise.all([
      getFpsData(await getDb()),
      getSnapshot('ru'),
      getPerf(),
    ]);
    const game = data.games.find((g) => g.slug === slug);
    if (!game) return { ok: false };
    const result = reverseFps(snapshot.products, perf, game, target, settings, data.model);
    return {
      ok: true,
      achievable: result.achievable,
      suggestion: result.suggestion,
      variants: result.variants.map((v) => {
        const lines = buildLines(v.result.build).filter((l) => slots.has(l.product.componentType));
        return {
          tier: v.tier,
          totalUzs: v.result.totalUzs,
          fps: v.estimate.fps,
          range: v.estimate.range,
          items: lines.map((l) => ({
            slot: l.product.componentType as PcComponentType,
            slug: l.product.slug,
            qty: l.qty,
          })),
          lines: lines.map((l) => ({
            slot: l.product.componentType,
            name: l.product.name,
            qty: l.qty,
          })),
        };
      }),
    };
  } catch (error) {
    console.error('reverseFpsAction failed', error);
    return { ok: false };
  }
}
