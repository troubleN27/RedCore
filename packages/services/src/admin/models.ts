import { models3d, products, type Database } from '@redcore/db';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { eq } from 'drizzle-orm';
import { invalidateCatalogCache } from '../catalog/snapshot';

// Своя 3D-модель товара из админки: проверка файла и хранение в базе.

export const MODEL_LIMITS = {
  /** Тело запроса функции Vercel — до 4,5 МБ: файл крупнее до сервера не дойдёт */
  maxBytes: 4_000_000,
  maxTriangles: 500_000,
} as const;

export class ModelValidationError extends Error {
  constructor(
    public readonly reason: 'not_glb' | 'too_large' | 'too_many_triangles' | 'empty' | 'invalid',
  ) {
    super(`GLB rejected: ${reason}`);
  }
}

export interface GlbReport {
  sizeBytes: number;
  triangles: number;
  meshes: number;
  materials: number;
  /** Наибольший габарит в единицах файла (сцена сама приведёт к размеру детали) */
  extent: number;
}

/** Проверка GLB: сигнатура, разбор glTF (в т.ч. meshopt/Draco-расширения), полигонаж. */
export async function inspectGlb(bytes: Uint8Array): Promise<GlbReport> {
  if (bytes.byteLength > MODEL_LIMITS.maxBytes) throw new ModelValidationError('too_large');
  // «glTF» в начале файла — бинарный контейнер GLB
  if (bytes.byteLength < 20 || new TextDecoder().decode(bytes.subarray(0, 4)) !== 'glTF') {
    throw new ModelValidationError('not_glb');
  }
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  let doc;
  try {
    doc = await io.readBinary(bytes);
  } catch {
    throw new ModelValidationError('invalid');
  }
  let triangles = 0;
  const meshes = doc.getRoot().listMeshes();
  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const count = prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION')?.getCount() ?? 0;
      triangles += Math.floor(count / 3);
    }
  }
  if (meshes.length === 0 || triangles === 0) throw new ModelValidationError('empty');
  if (triangles > MODEL_LIMITS.maxTriangles) throw new ModelValidationError('too_many_triangles');
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min, max } = scene ? getBounds(scene) : { min: [0, 0, 0], max: [0, 0, 0] };
  return {
    sizeBytes: bytes.byteLength,
    triangles,
    meshes: meshes.length,
    materials: doc.getRoot().listMaterials().length,
    extent: Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!),
  };
}

// ── Хранилище ──

/** Привязка модели к товару: записываем модель и ссылку в products.model3d. */
export async function attachModel(
  db: Database,
  input: {
    productId: string;
    filename: string;
    bytes: Uint8Array;
    report: GlbReport;
    uploadedBy: string;
  },
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(models3d)
      .values({
        productId: input.productId,
        filename: input.filename,
        url: '',
        data: input.bytes,
        sizeBytes: input.report.sizeBytes,
        triangles: input.report.triangles,
        uploadedBy: input.uploadedBy,
      })
      .returning({ id: models3d.id });
    const url = `/api/models/${row!.id}`;
    await tx.update(models3d).set({ url }).where(eq(models3d.id, row!.id));
    await tx
      .update(products)
      .set({
        model3d: {
          customUrl: url,
          sizeBytes: input.report.sizeBytes,
          triangles: input.report.triangles,
        },
      })
      .where(eq(products.id, input.productId));
    invalidateCatalogCache();
    return { id: row!.id, url };
  });
}

export async function detachModel(db: Database, productId: string) {
  await db.update(products).set({ model3d: null }).where(eq(products.id, productId));
  invalidateCatalogCache();
}

/** Файл модели из базы. */
export async function getStoredModel(db: Database, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db
    .select({ data: models3d.data, filename: models3d.filename })
    .from(models3d)
    .where(eq(models3d.id, id));
  return row?.data ? row : null;
}
