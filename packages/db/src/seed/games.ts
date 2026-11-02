import { eq, inArray, like } from 'drizzle-orm';
import * as schema from '../schema';
import { gameCover, games as gameSeeds, steamCoverUrl } from './data/games';
import type { SeedDb } from './seed';

type Tx = Parameters<Parameters<SeedDb['transaction']>[0]>[0];

const RESOLUTIONS = ['1080p', '1440p', '2160p'] as const;
const PRESETS = ['low', 'medium', 'high', 'ultra'] as const;

/**
 * Игры калькулятора FPS из демо-данных. Только добавление: коэффициенты и замеры,
 * исправленные в консоли или калибровкой, не затираются. Возвращает slug добавленных игр.
 */
export async function insertGames(tx: Tx): Promise<string[]> {
  const rows = await tx
    .insert(schema.games)
    .values(
      gameSeeds.map((g) => ({
        slug: g.slug,
        name: g.name,
        steamAppId: g.steamAppId,
        coverUrl: gameCover(g),
        hue: g.hue,
        profile: g.profile,
        cpuAlpha: g.cpuAlpha,
        vendorBias: g.vendorBias,
        ramMinGb: g.ramMinGb,
        ramRecGb: g.ramRecGb,
        supports: g.supports,
        thresholds: g.thresholds,
        lowRatio: g.lowRatio,
        fpsCap: g.fpsCap,
        sort: g.sort,
      })),
    )
    .onConflictDoNothing({ target: schema.games.slug })
    .returning({ id: schema.games.id, slug: schema.games.slug });
  const added = new Map(rows.map((row) => [row.slug, row.id]));
  const fresh = gameSeeds.filter((g) => added.has(g.slug));
  if (fresh.length > 0) {
    await tx.insert(schema.gameBenchmarks).values(
      fresh.flatMap((g) =>
        RESOLUTIONS.flatMap((resolution) =>
          PRESETS.map((preset) => ({
            gameId: added.get(g.slug)!,
            resolution,
            preset,
            refFpsGpu: g.gpuFps[resolution][preset],
            vramReqGb: g.vramGb[resolution][preset],
          })),
        ),
      ),
    );
    await tx.insert(schema.gameCpuCaps).values(
      fresh.flatMap((g) =>
        PRESETS.map((preset) => ({
          gameId: added.get(g.slug)!,
          preset,
          refFpsCpu: g.cpuFps[preset],
        })),
      ),
    );
  }
  return fresh.map((g) => g.slug);
}

export interface GamesSyncStats {
  added: string[];
  coversSet: string[];
  testGamesRemoved: number;
}

/**
 * Обновление игр рабочей базы: новые игры из демо-данных, недостающие обложки,
 * и удаление игр, которые создаёт E2E-тест консоли (slug `e2e-game-…`).
 */
export async function syncGames(db: SeedDb): Promise<GamesSyncStats> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(schema.games)
      .where(like(schema.games.slug, 'e2e-game-%'))
      .returning({ id: schema.games.id });
    const added = await insertGames(tx);

    const coversSet: string[] = [];
    const current = await tx
      .select({ slug: schema.games.slug, coverUrl: schema.games.coverUrl })
      .from(schema.games)
      .where(
        inArray(
          schema.games.slug,
          gameSeeds.map((g) => g.slug),
        ),
      );
    for (const { slug, coverUrl } of current) {
      const seed = gameSeeds.find((g) => g.slug === slug)!;
      const cover = gameCover(seed);
      // Пустая обложка или прежняя ссылка на CDN Steam; обложку, заданную в консоли, не трогаем
      const replaceable = coverUrl === null || coverUrl === steamCoverUrl(seed.steamAppId);
      if (cover === coverUrl || !replaceable) continue;
      await tx
        .update(schema.games)
        .set({ coverUrl: cover, steamAppId: seed.steamAppId })
        .where(eq(schema.games.slug, slug));
      coversSet.push(slug);
    }
    return { added, coversSet, testGamesRemoved: removed.length };
  });
}
