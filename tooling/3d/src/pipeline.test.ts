import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import { describe, expect, it } from 'vitest';
import { buildLod, countTriangles, createIO } from './build';
import { budgets, manifest, type ModelEntry } from './manifest';
import { checkBudgets, modelCredits } from './report';

/** Плотная UV-сфера радиусом 1 м (в «неправильных» единицах, как бывает у исходников). */
function sphereDocument(segments = 160): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= segments; y++) {
    for (let x = 0; x <= segments; x++) {
      const u = (x / segments) * Math.PI * 2;
      const v = (y / segments) * Math.PI;
      positions.push(Math.cos(u) * Math.sin(v), Math.cos(v), Math.sin(u) * Math.sin(v));
    }
  }
  for (let y = 0; y < segments; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      indices.push(a, a + segments + 1, a + 1, a + 1, a + segments + 1, a + segments + 2);
    }
  }
  const prim = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer),
    )
    .setIndices(
      doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer),
    )
    .setMaterial(doc.createMaterial('GPU_Shroud_Metal'));
  const mesh = doc.createMesh('fan').addPrimitive(prim);
  doc.createScene('scene').addChild(doc.createNode('root').setMesh(mesh));
  return doc;
}

const entry: ModelEntry = {
  key: 'test_sphere',
  title: 'Test',
  author: 'RedCore',
  uid: 'test',
  license: 'CC-BY-4.0',
  targetSizeMm: 120,
  lod0Triangles: 8_000,
  lod1Triangles: 2_000,
  materials: { shroud: 'body' },
};

describe('сборка модели', () => {
  it('LOD0/LOD1: полигонаж, масштаб в метрах, роли материалов, бюджеты', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'redcore-3d-'));
    const input = path.join(dir, 'model.glb');
    const source = sphereDocument();
    expect(countTriangles(source)).toBeGreaterThan(50_000);
    writeFileSync(input, await new NodeIO().writeBinary(source));

    const io = await createIO();
    const lod0 = await buildLod(input, entry, 0, io);
    const lod1 = await buildLod(input, entry, 1, io);
    expect(lod0.triangles).toBeLessThanOrEqual(entry.lod0Triangles * 1.1);
    expect(lod1.triangles).toBeLessThan(lod0.triangles);
    expect(lod0.bytes.byteLength).toBeLessThan(budgets.lod0Bytes);
    expect(lod1.bytes.byteLength).toBeLessThan(budgets.lod1Bytes);

    const built = await io.readBinary(lod0.bytes);
    expect(
      built
        .getRoot()
        .listExtensionsUsed()
        .map((e) => e.extensionName),
    ).toContain('EXT_meshopt_compression');
    expect(built.getRoot().listMaterials()[0]?.getName()).toBe('body_GPU_Shroud_Metal');
    const { min, max } = getBounds(built.getRoot().listScenes()[0]!);
    expect(Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])).toBeCloseTo(0.12, 2);
    // Центр — в начале координат
    expect(Math.abs(min[1] + max[1])).toBeLessThan(1e-3);
  }, 60_000);
});

describe('бюджеты и атрибуция', () => {
  it('превышение бюджета и модель вне манифеста — ошибки', () => {
    const problems = checkBudgets({
      gpu_3fan: {
        lod0: '',
        lod1: '',
        sizeLod0: 2_000_000,
        sizeLod1: 100_000,
        triangles: 10,
        trianglesLod1: 5,
      },
      unknown: { lod0: '', lod1: '', sizeLod0: 1, sizeLod1: 1, triangles: 1, trianglesLod1: 1 },
    });
    expect(problems.some((p) => p.startsWith('gpu_3fan: LOD0'))).toBe(true);
    expect(problems.some((p) => p.startsWith('unknown'))).toBe(true);
  });

  it('в атрибуции только собранные модели и все — CC BY', () => {
    const credits = modelCredits({
      fan_120: { lod0: '', lod1: '', sizeLod0: 1, sizeLod1: 1, triangles: 1, trianglesLod1: 1 },
    });
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ author: 'DIEKO', license: 'CC BY 4.0' });
  });

  it('манифест: уникальные ключи, только CC BY', () => {
    expect(new Set(manifest.map((e) => e.key)).size).toBe(manifest.length);
    expect(
      manifest.every((e) => e.license === 'CC-BY-4.0' && e.lod1Triangles < e.lod0Triangles),
    ).toBe(true);
  });
});
