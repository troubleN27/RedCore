import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectGlb, ModelValidationError } from './models';

const fixtures = path.resolve(__dirname, '../../../../e2e/fixtures');

describe('проверка своей GLB', () => {
  it('корректный файл: треугольники, габарит, материалы', async () => {
    const report = await inspectGlb(new Uint8Array(readFileSync(path.join(fixtures, 'box.glb'))));
    expect(report).toMatchObject({ triangles: 12, meshes: 1, materials: 1 });
    expect(report.extent).toBeCloseTo(0.3, 3);
  });

  it('не GLB и слишком большой файл отклоняются', async () => {
    await expect(
      inspectGlb(new Uint8Array(readFileSync(path.join(fixtures, 'not-a-model.glb')))),
    ).rejects.toMatchObject({
      reason: 'not_glb',
    });
    await expect(inspectGlb(new Uint8Array(16_000_000))).rejects.toBeInstanceOf(
      ModelValidationError,
    );
  });

  it('битый контейнер GLB — invalid', async () => {
    const bytes = new Uint8Array(64);
    bytes.set(new TextEncoder().encode('glTF'));
    await expect(inspectGlb(bytes)).rejects.toMatchObject({ reason: 'invalid' });
  });
});
