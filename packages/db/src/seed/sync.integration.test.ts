import { PGlite } from '@electric-sql/pglite';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrationsFolder } from '../migrator';
import * as schema from '../schema';
import { DEFAULT_USD_UZS_RATE } from './pricing';
import { seedDatabase, type SeedDb } from './seed';
import { syncCatalog } from './sync';

// «Рабочая база»: каталог с правками магазина, где ещё нет новых разделов.
const client = new PGlite();
const db = drizzle({ client, schema, casing: 'snake_case' });

beforeAll(async () => {
  await migrate(db, { migrationsFolder });
  await seedDatabase(db as unknown as SeedDb, DEFAULT_USD_UZS_RATE);
  // Магазин поменял цену и остаток процессора
  await db
    .update(schema.products)
    .set({ priceUzs: 1_230_000, stockQty: 1 })
    .where(eq(schema.products.slug, 'amd-ryzen-7-9800x3d'));
  // Ноутбуков и кресел в этой базе ещё нет
  const removed = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(inArray(schema.categories.slug, ['gaming-laptops', 'laptops', 'gaming-chairs']));
  await db.delete(schema.products).where(
    inArray(
      schema.products.categoryId,
      removed.map((r) => r.id),
    ),
  );
  await db.delete(schema.categories).where(
    inArray(
      schema.categories.id,
      removed.map((r) => r.id),
    ),
  );
});

afterAll(async () => {
  await client.close();
});

describe('синхронизация каталога', () => {
  it('добавляет новые разделы и товары, не трогая цены и остатки', async () => {
    const stats = await syncCatalog(db as unknown as SeedDb, DEFAULT_USD_UZS_RATE);
    expect(stats.categoriesAdded.sort()).toEqual(['gaming-chairs', 'gaming-laptops', 'laptops']);
    expect(stats.productsAdded).toBeGreaterThan(20);

    const [cpu] = await db
      .select({ price: schema.products.priceUzs, stock: schema.products.stockQty })
      .from(schema.products)
      .where(eq(schema.products.slug, 'amd-ryzen-7-9800x3d'));
    expect(cpu).toEqual({ price: 1_230_000, stock: 1 });

    const laptops = await db
      .select({ slug: schema.products.slug })
      .from(schema.products)
      .where(eq(schema.products.componentType, 'laptop'));
    expect(laptops.length).toBeGreaterThan(10);
  });

  it('повторный запуск ничего не добавляет', async () => {
    const stats = await syncCatalog(db as unknown as SeedDb, DEFAULT_USD_UZS_RATE);
    expect(stats).toEqual({ categoriesAdded: [], productsAdded: 0, productsMoved: [] });
  });
});
