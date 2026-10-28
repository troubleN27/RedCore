import {
  gameBenchmarks,
  gameCpuCaps,
  games,
  perfCpu,
  perfGpu,
  settings,
  type Database,
} from '@redcore/db';
import {
  DEFAULT_FPS_MODEL,
  parseFpsCsvRows,
  presets,
  resolutions,
  type CalibrationResult,
  type FpsCpu,
  type FpsGpu,
  type FpsModel,
  type GameData,
  type Preset,
} from '@redcore/domain';
import type { Resolution } from '@redcore/domain';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AdminValidationError } from '../admin/catalog';

// Данные калькулятора FPS: игры с замерами, индексы GPU/CPU и параметры модели.
// Читаются одним снимком (20 игр × 16 чисел) и кэшируются; правки в консоли сбрасывают кэш,
// поэтому новая игра сразу видна на /fps и в конфигураторе.

export type FpsGame = GameData & {
  id: string;
  steamAppId: number | null;
  coverUrl: string | null;
  hue: number;
  isActive: boolean;
  sort: number;
};

export interface FpsData {
  games: FpsGame[];
  gpus: FpsGpu[];
  cpus: FpsCpu[];
  model: FpsModel;
}

const TTL_MS = 60_000;
let cache: { at: number; data: Promise<FpsData> } | undefined;

function emptyGrid<T>(value: T) {
  return Object.fromEntries(
    resolutions.map((r) => [r, Object.fromEntries(presets.map((p) => [p, value]))]),
  ) as Record<Resolution, Record<Preset, T>>;
}

async function loadGames(db: Database, onlyActive: boolean): Promise<FpsGame[]> {
  const [rows, benches, caps] = await Promise.all([
    db
      .select()
      .from(games)
      .where(onlyActive ? eq(games.isActive, true) : undefined)
      .orderBy(asc(games.sort), asc(games.name)),
    db.select().from(gameBenchmarks),
    db.select().from(gameCpuCaps),
  ]);
  return rows.map((g) => {
    const gpuFps = emptyGrid(0);
    const vramGb = emptyGrid(0);
    for (const b of benches) {
      if (b.gameId !== g.id) continue;
      gpuFps[b.resolution][b.preset] = b.refFpsGpu;
      vramGb[b.resolution][b.preset] = b.vramReqGb;
    }
    const cpuFps = Object.fromEntries(presets.map((p) => [p, 0])) as Record<Preset, number>;
    for (const c of caps) if (c.gameId === g.id) cpuFps[c.preset] = c.refFpsCpu;
    return {
      id: g.id,
      slug: g.slug,
      name: g.name,
      profile: g.profile,
      cpuAlpha: g.cpuAlpha,
      vendorBias: g.vendorBias,
      ramMinGb: g.ramMinGb,
      ramRecGb: g.ramRecGb,
      supports: g.supports,
      thresholds: g.thresholds,
      lowRatio: g.lowRatio,
      fpsCap: g.fpsCap,
      gpuFps,
      vramGb,
      cpuFps,
      steamAppId: g.steamAppId,
      coverUrl: g.coverUrl,
      hue: g.hue,
      isActive: g.isActive,
      sort: g.sort,
    };
  });
}

/** Игра пригодна для расчёта, только если заполнены все 12 замеров и 4 потолка CPU. */
export function gameIsComplete(game: GameData): boolean {
  return (
    resolutions.every((r) =>
      presets.every((p) => game.gpuFps[r][p] > 0 && game.vramGb[r][p] > 0),
    ) && presets.every((p) => game.cpuFps[p] > 0)
  );
}

async function loadFpsData(db: Database): Promise<FpsData> {
  const [gameList, gpuRows, cpuRows, modelRow] = await Promise.all([
    loadGames(db, true),
    db.select().from(perfGpu).orderBy(asc(perfGpu.index1440)),
    db.select().from(perfCpu).orderBy(asc(perfCpu.gamingIndex)),
    db.select().from(settings).where(eq(settings.key, 'fps_model')),
  ]);
  const stored = modelRow[0]?.value as Partial<FpsModel> | undefined;
  return {
    games: gameList.filter(gameIsComplete),
    gpus: gpuRows.reverse().map((g) => ({
      key: g.key,
      name: g.name,
      vendor: g.vendor,
      index1080: g.index1080,
      index1440: g.index1440,
      index2160: g.index2160,
      vramGb: g.vramGb,
      frameGen: g.frameGen,
    })),
    cpus: cpuRows.reverse().map((c) => ({ key: c.key, name: c.name, gamingIndex: c.gamingIndex })),
    model: { ...DEFAULT_FPS_MODEL, ...stored },
  };
}

export function getFpsData(db: Database): Promise<FpsData> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const data = loadFpsData(db);
    cache = { at: Date.now(), data };
    data.catch(() => (cache = undefined));
  }
  return cache.data;
}

export function invalidateFpsCache(): void {
  cache = undefined;
}

// ── Консоль ──

export function listGamesAdmin(db: Database) {
  return loadGames(db, false);
}

const quad = z.object({
  low: z.number().positive(),
  medium: z.number().positive(),
  high: z.number().positive(),
  ultra: z.number().positive(),
});
const grid = z.object({ '1080p': quad, '1440p': quad, '2160p': quad });

export const gameInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  steamAppId: z.number().int().positive().nullable(),
  coverUrl: z.url().nullable(),
  hue: z.number().int().min(0).max(360),
  profile: z.enum(['aaa', 'competitive']),
  cpuAlpha: z.number().min(0.3).max(1.2),
  vendorBias: z.object({
    nvidia: z.number().min(0.5).max(1.5).optional(),
    amd: z.number().min(0.5).max(1.5).optional(),
    intel: z.number().min(0.5).max(1.5).optional(),
  }),
  ramMinGb: z.number().int().min(4).max(128),
  ramRecGb: z.number().int().min(4).max(128),
  supports: z.object({
    dlss: z.boolean(),
    fsr: z.boolean(),
    xess: z.boolean(),
    frameGen: z.boolean(),
  }),
  thresholds: z
    .object({ good: z.number().int().positive(), playable: z.number().int().positive() })
    .refine((t) => t.good > t.playable),
  lowRatio: z.number().min(0.3).max(1),
  fpsCap: z.number().int().positive().nullable(),
  isActive: z.boolean(),
  sort: z.number().int().min(0),
  gpuFps: grid,
  vramGb: grid,
  cpuFps: quad,
});

export type GameInput = z.input<typeof gameInputSchema>;

/** Создание или правка игры вместе со всеми замерами (одна транзакция). */
export async function saveGame(db: Database, id: string | null, input: GameInput) {
  const parsed = gameInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.issues.map((i) => i.path.join('.')));
  }
  const { gpuFps, vramGb, cpuFps, ...fields } = parsed.data;
  const saved = await db.transaction(async (tx) => {
    const [row] = id
      ? await tx
          .update(games)
          .set({ ...fields, updatedAt: sql`now()` })
          .where(eq(games.id, id))
          .returning({ id: games.id, slug: games.slug })
      : await tx.insert(games).values(fields).returning({ id: games.id, slug: games.slug });
    if (!row) throw new AdminValidationError(['id']);
    await tx.delete(gameBenchmarks).where(eq(gameBenchmarks.gameId, row.id));
    await tx.delete(gameCpuCaps).where(eq(gameCpuCaps.gameId, row.id));
    await tx.insert(gameBenchmarks).values(
      resolutions.flatMap((resolution) =>
        presets.map((preset) => ({
          gameId: row.id,
          resolution,
          preset,
          refFpsGpu: gpuFps[resolution][preset],
          vramReqGb: vramGb[resolution][preset],
        })),
      ),
    );
    await tx
      .insert(gameCpuCaps)
      .values(presets.map((preset) => ({ gameId: row.id, preset, refFpsCpu: cpuFps[preset] })));
    return row;
  });
  invalidateFpsCache();
  return saved;
}

export interface BenchmarkImportResult {
  updated: number;
  errors: { line: number; message: string }[];
}

/**
 * Импорт замеров CSV: `game,resolution,preset,gpu_fps,vram_gb[,cpu_fps]`.
 * Строки с ошибками пропускаются и перечисляются в ответе; остальное применяется.
 */
export async function importBenchmarksCsv(
  db: Database,
  text: string,
): Promise<BenchmarkImportResult> {
  const { rows, errors } = parseFpsCsvRows(
    text,
    ['game', 'resolution', 'preset', 'gpu_fps', 'vram_gb'],
    ['cpu_fps'],
  );
  const gameRows = await db.select({ id: games.id, slug: games.slug }).from(games);
  const idBySlug = new Map(gameRows.map((g) => [g.slug, g.id]));
  const valid: {
    gameId: string;
    resolution: Resolution;
    preset: Preset;
    gpu: number;
    vram: number;
    cpu: number | null;
  }[] = [];
  for (const { line, cells } of rows) {
    const gameId = idBySlug.get(cells.game!);
    const resolution = cells.resolution as Resolution;
    const preset = cells.preset as Preset;
    const gpu = Number(cells.gpu_fps);
    const vram = Number(cells.vram_gb);
    const cpu = cells.cpu_fps ? Number(cells.cpu_fps) : null;
    if (!gameId) errors.push({ line, message: `unknown game: ${cells.game}` });
    else if (!resolutions.includes(resolution))
      errors.push({ line, message: `bad resolution: ${resolution}` });
    else if (!presets.includes(preset)) errors.push({ line, message: `bad preset: ${preset}` });
    else if (!(gpu > 0) || !(vram > 0) || (cpu !== null && !(cpu > 0)))
      errors.push({ line, message: 'numbers must be positive' });
    else valid.push({ gameId, resolution, preset, gpu, vram, cpu });
  }
  if (valid.length > 0) {
    await db.transaction(async (tx) => {
      for (const v of valid) {
        await tx
          .insert(gameBenchmarks)
          .values({
            gameId: v.gameId,
            resolution: v.resolution,
            preset: v.preset,
            refFpsGpu: v.gpu,
            vramReqGb: v.vram,
          })
          .onConflictDoUpdate({
            target: [gameBenchmarks.gameId, gameBenchmarks.resolution, gameBenchmarks.preset],
            set: { refFpsGpu: v.gpu, vramReqGb: v.vram },
          });
        if (v.cpu !== null) {
          await tx
            .insert(gameCpuCaps)
            .values({ gameId: v.gameId, preset: v.preset, refFpsCpu: v.cpu })
            .onConflictDoUpdate({
              target: [gameCpuCaps.gameId, gameCpuCaps.preset],
              set: { refFpsCpu: v.cpu },
            });
        }
      }
    });
    invalidateFpsCache();
  }
  return { updated: valid.length, errors: errors.sort((a, b) => a.line - b.line) };
}

/** Применить результат `pnpm fps:calibrate --apply`: α и поправки игр, k модели. */
export async function applyCalibration(db: Database, result: CalibrationResult) {
  await db.transaction(async (tx) => {
    for (const [slug, fit] of Object.entries(result.games)) {
      await tx
        .update(games)
        .set({ cpuAlpha: fit.cpuAlpha, vendorBias: fit.vendorBias, updatedAt: sql`now()` })
        .where(eq(games.slug, slug));
    }
    await tx
      .insert(settings)
      .values({ key: 'fps_model', value: result.model })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: result.model, updatedAt: sql`now()` },
      });
  });
  invalidateFpsCache();
}
