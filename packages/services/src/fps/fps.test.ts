import type { Database } from '@redcore/db';
import { createTestDatabase, type TestDatabase } from '@redcore/db/testing';
import { estimateFps, reverseFps } from '@redcore/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdminValidationError } from '../admin/catalog';
import { getCatalogSnapshot, getPerfIndex, invalidateCatalogCache } from '../catalog/snapshot';
import {
  applyCalibration,
  getFpsData,
  importBenchmarksCsv,
  invalidateFpsCache,
  listGamesAdmin,
  saveGame,
  type GameInput,
} from './fps';

let testDb: TestDatabase;
let db: Database;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  invalidateFpsCache();
  invalidateCatalogCache();
});

afterAll(async () => {
  await testDb.close();
});

const dual = { capacityGb: 32, channels: 2, type: 'DDR5', speedMts: 6000 } as const;
const quad = (low: number, medium: number, high: number, ultra: number) => ({
  low,
  medium,
  high,
  ultra,
});

describe('калькулятор FPS: данные', () => {
  it('seed: 20 игр с полными замерами, индексы GPU/CPU с видеопамятью', async () => {
    const data = await getFpsData(db);
    expect(data.games).toHaveLength(20);
    expect(data.model.k).toBe(5);
    const cp = data.games.find((g) => g.slug === 'cyberpunk-2077')!;
    expect(cp.gpuFps['1440p'].ultra).toBeGreaterThan(0);
    expect(cp.coverUrl).toContain('1091500');
    expect(data.games.find((g) => g.slug === 'elden-ring')!.fpsCap).toBe(60);
    const ref = data.gpus.find((g) => g.key === 'rtx-5070')!;
    expect(ref).toMatchObject({ index1440: 1, vramGb: 12 });
    // Эталонная пара на эталонной игре: оценка в пределах разумного
    const cpu = data.cpus.find((c) => c.key === 'ryzen-7-9800x3d')!;
    const r = estimateFps(cp, ref, cpu, dual, {
      resolution: '1440p',
      preset: 'ultra',
      upscale: 'off',
      frameGen: 'off',
    });
    expect(r.fps).toBeGreaterThan(60);
    expect(r.fps).toBeLessThanOrEqual(cp.gpuFps['1440p'].ultra);
  });

  it('обратный подбор на seed-каталоге: Cyberpunk 1440p Ultra 60+ — сборки в наличии', async () => {
    const data = await getFpsData(db);
    const snapshot = await getCatalogSnapshot(db, 'ru');
    const perf = await getPerfIndex(db);
    const cp = data.games.find((g) => g.slug === 'cyberpunk-2077')!;
    const result = reverseFps(snapshot.products, perf, cp, 60, {
      resolution: '1440p',
      preset: 'ultra',
      upscale: 'off',
    });
    expect(result.achievable).toBe(true);
    expect(result.variants.length).toBeGreaterThanOrEqual(2);
    for (const v of result.variants) {
      expect(v.estimate.fps).toBeGreaterThanOrEqual(60);
      expect(v.result.check.issues.filter((i) => i.severity === 'error')).toEqual([]);
      // Сбалансированные сборки: без «бутылочного горлышка» по процессору
      expect(v.result.check.issues.map((i) => i.code)).not.toContain('perf.cpuBottleneck');
    }
  });

  it('новая игра из консоли сразу видна калькулятору; неполная форма отклоняется', async () => {
    await getFpsData(db); // прогрев кэша
    const g = (k: number) => quad(200 * k, 170 * k, 140 * k, 120 * k);
    const input: GameInput = {
      slug: 'arc-raiders',
      name: 'ARC Raiders',
      steamAppId: null,
      coverUrl: null,
      hue: 30,
      profile: 'aaa',
      cpuAlpha: 0.8,
      vendorBias: {},
      ramMinGb: 12,
      ramRecGb: 16,
      supports: { dlss: true, fsr: true, xess: true, frameGen: true },
      thresholds: { good: 60, playable: 30 },
      lowRatio: 0.78,
      fpsCap: null,
      isActive: true,
      sort: 50,
      gpuFps: { '1080p': g(1.35), '1440p': g(1), '2160p': g(0.52) },
      vramGb: { '1080p': quad(4, 5, 6, 7), '1440p': quad(5, 6, 7, 8), '2160p': quad(6, 7, 8, 10) },
      cpuFps: quad(220, 200, 185, 170),
    };
    const saved = await saveGame(db, null, input);
    const data = await getFpsData(db);
    expect(data.games.map((x) => x.slug)).toContain('arc-raiders');
    await expect(
      saveGame(db, saved.id, { ...input, thresholds: { good: 30, playable: 60 } }),
    ).rejects.toBeInstanceOf(AdminValidationError);
    await saveGame(db, saved.id, { ...input, isActive: false });
    expect((await getFpsData(db)).games.map((x) => x.slug)).not.toContain('arc-raiders');
    expect((await listGamesAdmin(db)).map((x) => x.slug)).toContain('arc-raiders');
  });

  it('импорт CSV: применяет корректные строки и перечисляет ошибки', async () => {
    const csv = [
      'game,resolution,preset,gpu_fps,vram_gb,cpu_fps',
      'cyberpunk-2077,1440p,ultra,81,9.2,170',
      'cyberpunk-2077,8k,ultra,10,9,',
      'no-such-game,1440p,ultra,10,9,',
      'cyberpunk-2077,1080p,low,-5,9,',
    ].join('\n');
    const result = await importBenchmarksCsv(db, csv);
    expect(result.updated).toBe(1);
    expect(result.errors.map((e) => e.line)).toEqual([3, 4, 5]);
    const cp = (await getFpsData(db)).games.find((g) => g.slug === 'cyberpunk-2077')!;
    expect(cp.gpuFps['1440p'].ultra).toBe(81);
    expect(cp.cpuFps.ultra).toBe(170);
    const bad = await importBenchmarksCsv(db, 'game,fps\nx,1');
    expect(bad).toMatchObject({ updated: 0, errors: [{ line: 1 }] });
  });

  it('калибровка применяется к играм и модели', async () => {
    await applyCalibration(db, {
      model: { k: 6 },
      games: { 'dota-2': { cpuAlpha: 0.9, vendorBias: { amd: 1.05 } } },
      mapeBefore: 0.2,
      mapeAfter: 0.1,
      points: 1,
      skipped: 0,
      fitted: ['dota-2'],
    });
    const data = await getFpsData(db);
    expect(data.model.k).toBe(6);
    expect(data.games.find((g) => g.slug === 'dota-2')).toMatchObject({
      cpuAlpha: 0.9,
      vendorBias: { amd: 1.05 },
    });
  });
});
