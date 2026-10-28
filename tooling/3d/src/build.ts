import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  center,
  dedup,
  getBounds,
  meshopt,
  prune,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { manifest, type ModelEntry } from './manifest';
import { outDir, rawModelFile, registryFile } from './paths';

// Сборка базовых моделей: из исходника Sketchfab получаем LOD0 и LOD1 для сайта.
// Шаги: очистка (prune/dedup/weld) → роли материалов → масштаб в метры и центр →
// упрощение meshoptimizer до целевого полигонажа → текстуры WebP (2K / 512 px) → meshopt-сжатие.

export interface BuiltModel {
  lod0: string;
  lod1: string;
  sizeLod0: number;
  sizeLod1: number;
  triangles: number;
  trianglesLod1: number;
}

export function countTriangles(doc: Document): number {
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const count = indices ? indices.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0);
      total += Math.floor(count / 3);
    }
  }
  return total;
}

/** Материалы исходника → общие роли сцены (body / rgb / glass) по подстроке имени. */
export function assignMaterialRoles(doc: Document, roles: ModelEntry['materials'] = {}) {
  for (const material of doc.getRoot().listMaterials()) {
    const name = material.getName().toLowerCase();
    const role = Object.entries(roles).find(([needle]) => name.includes(needle.toLowerCase()))?.[1];
    if (role) material.setName(`${role}_${material.getName()}`);
  }
}

/** Масштаб к реальному габариту детали (метры) и начало координат в центре. */
function normalize(doc: Document, targetSizeMm: number) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) return;
  const { min, max } = getBounds(scene);
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  if (extent <= 0) return;
  const factor = targetSizeMm / 1000 / extent;
  for (const node of scene.listChildren()) {
    const [tx, ty, tz] = node.getTranslation();
    const [sx, sy, sz] = node.getScale();
    node.setTranslation([tx * factor, ty * factor, tz * factor]);
    node.setScale([sx * factor, sy * factor, sz * factor]);
  }
}

export async function buildLod(
  input: string,
  entry: ModelEntry,
  lod: 0 | 1,
  io: NodeIO,
): Promise<{ bytes: Uint8Array; triangles: number }> {
  const doc = await io.read(input);
  assignMaterialRoles(doc, entry.materials);
  normalize(doc, entry.targetSizeMm);
  const target = lod === 0 ? entry.lod0Triangles : entry.lod1Triangles;
  const before = countTriangles(doc);
  await doc.transform(
    prune(),
    dedup(),
    weld(),
    center({ pivot: 'center' }),
    ...(before > target
      ? [
          simplify({
            simplifier: MeshoptSimplifier,
            ratio: target / before,
            error: lod === 0 ? 0.001 : 0.01,
          }),
        ]
      : []),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: lod === 0 ? [2048, 2048] : [512, 512],
    }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  return { bytes: await io.writeBinary(doc), triangles: countTriangles(doc) };
}

export async function createIO() {
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
}

async function main() {
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
  mkdirSync(outDir, { recursive: true });
  const registry: Record<string, BuiltModel> = {};
  const only = process.argv.slice(2);

  for (const entry of manifest) {
    if (only.length > 0 && !only.includes(entry.key)) continue;
    const input = rawModelFile(entry.key);
    if (!input) {
      console.log(`· ${entry.key}: исходника нет — на сайте будет процедурная модель`);
      continue;
    }
    const lod0 = await buildLod(input, entry, 0, io);
    const lod1 = await buildLod(input, entry, 1, io);
    writeFileSync(path.join(outDir, `${entry.key}.glb`), lod0.bytes);
    writeFileSync(path.join(outDir, `${entry.key}-lod1.glb`), lod1.bytes);
    registry[entry.key] = {
      lod0: `/models/${entry.key}.glb`,
      lod1: `/models/${entry.key}-lod1.glb`,
      sizeLod0: lod0.bytes.byteLength,
      sizeLod1: lod1.bytes.byteLength,
      triangles: lod0.triangles,
      trianglesLod1: lod1.triangles,
    };
    const sourceMb = statSync(input).size / 1e6;
    console.log(
      `✓ ${entry.key}: ${sourceMb.toFixed(1)} МБ → LOD0 ${(lod0.bytes.byteLength / 1e3).toFixed(0)} КБ / ${lod0.triangles} тр., LOD1 ${(lod1.bytes.byteLength / 1e3).toFixed(0)} КБ`,
    );
  }

  // Частичная сборка (`pnpm assets:build gpu_3fan`) не затирает остальные модели
  const previous =
    only.length > 0
      ? (JSON.parse(readFileSync(registryFile, 'utf8')) as Record<string, BuiltModel>)
      : {};
  writeFileSync(registryFile, `${JSON.stringify({ ...previous, ...registry }, null, 2)}\n`);
  console.log(
    `Реестр: ${Object.keys({ ...previous, ...registry }).length} моделей → ${path.relative(process.cwd(), registryFile)}`,
  );
}

if (process.argv[1]?.endsWith('build.ts')) void main();
