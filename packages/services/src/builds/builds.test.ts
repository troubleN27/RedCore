import { analyticsEvents, builds, type Database } from '@redcore/db';
import { createTestDatabase, type TestDatabase } from '@redcore/db/testing';
import type { PerfIndex } from '@redcore/domain';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCatalogSnapshot, getPerfIndex, invalidateCatalogCache } from '../catalog/snapshot';
import type { CatalogSnapshot, ProductSummary } from '../catalog/types';
import {
  BuildValidationError,
  buildSignature,
  generatePublicId,
  getSavedBuild,
  resolveBuild,
  saveBuild,
  trackEvent,
} from './builds';

let testDb: TestDatabase;
let db: Database;
let ru: CatalogSnapshot;
let perf: PerfIndex;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  invalidateCatalogCache();
  ru = await getCatalogSnapshot(db, 'ru');
  perf = await getPerfIndex(db);
});

afterAll(async () => {
  await testDb.close();
});

const find = (predicate: (p: ProductSummary) => boolean): ProductSummary => {
  const product = ru.products.find(predicate);
  if (!product) throw new Error('fixture product not found');
  return product;
};
const spec = (p: ProductSummary) => p.specs as Record<string, unknown>;

/** Готовая сборка из seed — заведомо совместимая */
function prebuiltItems() {
  const [, slugs] = [...ru.prebuiltComponents][0]!;
  return slugs.map((slug) => ({ slug, qty: 1 }));
}

describe('resolveBuild', () => {
  it('раскладывает товары по слотам и сортирует по порядку конфигуратора', () => {
    const cpu = find((p) => p.componentType === 'cpu');
    const gpu = find((p) => p.componentType === 'gpu');
    const { build, lines } = resolveBuild(ru, [
      { slug: gpu.slug, qty: 3 },
      { slug: cpu.slug, qty: 1 },
    ]);
    expect(build.cpu?.id).toBe(cpu.id);
    expect(build.gpu?.id).toBe(gpu.id);
    // У одиночного слота количество всегда 1
    expect(lines.map((l) => [l.slot, l.qty])).toEqual([
      ['cpu', 1],
      ['gpu', 1],
    ]);
  });

  it('накопители складываются, повторный CPU заменяет предыдущий', () => {
    const ssd = find((p) => p.componentType === 'storage');
    const [cpuA, cpuB] = ru.products.filter((p) => p.componentType === 'cpu');
    const { lines } = resolveBuild(ru, [
      { slug: ssd.slug, qty: 1 },
      { slug: ssd.slug, qty: 2 },
      { slug: cpuA!.slug, qty: 1 },
      { slug: cpuB!.slug, qty: 1 },
    ]);
    expect(lines.find((l) => l.slot === 'storage')?.qty).toBe(3);
    expect(lines.filter((l) => l.slot === 'cpu').map((l) => l.product.slug)).toEqual([cpuB!.slug]);
  });

  it('отклоняет неизвестный товар и периферию', () => {
    expect(() => resolveBuild(ru, [{ slug: 'no-such-product', qty: 1 }])).toThrow(
      BuildValidationError,
    );
    const mouse = find((p) => p.componentType === 'mouse');
    expect(() => resolveBuild(ru, [{ slug: mouse.slug, qty: 1 }])).toThrow(/not_pc_component/);
  });
});

describe('идентификаторы', () => {
  it('publicId — 10 символов base62 и не повторяется', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generatePublicId()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[0-9A-Za-z]{10}$/);
  });

  it('подпись не зависит от порядка позиций', () => {
    const cpu = find((p) => p.componentType === 'cpu');
    const gpu = find((p) => p.componentType === 'gpu');
    const a = resolveBuild(ru, [
      { slug: cpu.slug, qty: 1 },
      { slug: gpu.slug, qty: 1 },
    ]).lines;
    const b = [...a].reverse();
    expect(buildSignature(a)).toBe(buildSignature(b));
  });
});

describe('сохранение и загрузка', () => {
  it('сохраняет сборку со снимком цены и статуса, пишет событие', async () => {
    const items = prebuiltItems();
    expect(items.length).toBeGreaterThan(5);
    const saved = await saveBuild(db, ru, perf, { items, name: '  Моя сборка  ' });
    expect(saved.publicId).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(saved.name).toBe('Моя сборка');
    expect(saved.check.status).not.toBe('errors');

    const [row] = await db.select().from(builds).where(eq(builds.publicId, saved.publicId));
    expect(row?.totalUzs).toBe(saved.check.totalUzs);
    expect(row?.compatStatus).toBe(saved.check.status);
    expect(row?.powerW).toBe(saved.check.power.loadW);

    const events = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.buildId, row!.id));
    expect(events.map((e) => e.type)).toEqual(['build_saved']);
  });

  it('по ссылке открывается та же сборка, просмотры считаются', async () => {
    const saved = await saveBuild(db, ru, perf, { items: prebuiltItems() });
    const loaded = await getSavedBuild(db, ru, perf, saved.publicId, { countView: true });
    expect(loaded?.lines.map((l) => [l.product.slug, l.qty])).toEqual(
      saved.lines.map((l) => [l.product.slug, l.qty]),
    );
    expect(loaded?.check.totalUzs).toBe(saved.check.totalUzs);
    expect(loaded?.viewCount).toBe(1);
    const again = await getSavedBuild(db, ru, perf, saved.publicId);
    expect(again?.viewCount).toBe(1);
  });

  it('сервер сам пересчитывает несовместимость — AM5 CPU в плате LGA1700', async () => {
    const cpu = find((p) => p.componentType === 'cpu' && spec(p).socket === 'AM5');
    const board = find((p) => p.componentType === 'motherboard' && spec(p).socket === 'LGA1700');
    const saved = await saveBuild(db, ru, perf, {
      items: [
        { slug: cpu.slug, qty: 1 },
        { slug: board.slug, qty: 1 },
      ],
    });
    expect(saved.check.status).toBe('errors');
    expect(saved.check.issues.map((i) => i.code)).toContain('cpu.socketMismatch');
  });

  it('несуществующая или кривая ссылка — null', async () => {
    expect(await getSavedBuild(db, ru, perf, 'AAAAAAAAAA')).toBeNull();
    expect(await getSavedBuild(db, ru, perf, "x'; drop table builds;--")).toBeNull();
  });

  it('валидирует ввод', async () => {
    await expect(saveBuild(db, ru, perf, { items: [] })).rejects.toThrow(/invalid_input/);
    const cpu = find((p) => p.componentType === 'cpu');
    await expect(saveBuild(db, ru, perf, { items: [{ slug: cpu.slug, qty: 99 }] })).rejects.toThrow(
      BuildValidationError,
    );
  });

  it('события воронки', async () => {
    await trackEvent(db, 'build_to_cart', { lines: 3 });
    const rows = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.type, 'build_to_cart'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toEqual({ lines: 3 });
  });
});
