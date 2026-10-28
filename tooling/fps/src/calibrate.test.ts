import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestDatabase, type TestDatabase } from '@redcore/db/testing';
import { getFpsData } from '@redcore/services';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCalibration } from './run';

const here = path.dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(path.join(here, '..', 'data', 'control.csv'), 'utf8');

let testDb: TestDatabase;
beforeAll(async () => {
  testDb = await createTestDatabase();
});
afterAll(async () => {
  await testDb.close();
});

describe('fps:calibrate на контрольных точках', () => {
  it('≥ 60 точек сопоставлены с играми и индексами, MAPE ≤ 15%', async () => {
    const result = await runCalibration(testDb.db, csv);
    expect(result.points).toBeGreaterThanOrEqual(60);
    expect(result.skipped).toBe(0);
    expect(result.mapeBefore).toBeLessThanOrEqual(0.15);
    expect(result.mapeAfter).toBeLessThanOrEqual(result.mapeBefore);
  });

  it('--apply записывает коэффициенты: калькулятор считает уже с ними', async () => {
    const result = await runCalibration(testDb.db, csv, { apply: true });
    const data = await getFpsData(testDb.db);
    expect(data.model.k).toBe(result.model.k);
    const cp = data.games.find((g) => g.slug === 'cyberpunk-2077')!;
    expect(cp.cpuAlpha).toBe(result.games['cyberpunk-2077']!.cpuAlpha);
  });
});
