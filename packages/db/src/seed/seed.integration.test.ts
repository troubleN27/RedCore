import { PGlite } from '@electric-sql/pglite';
import { parseSpecs } from '@redcore/domain';
import { and, count, eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrationsFolder } from '../migrator';
import * as schema from '../schema';
import { DEFAULT_USD_UZS_RATE } from './pricing';
import { seedDatabase, type SeedDb, type SeedStats } from './seed';

// Postgres в WASM: проверяем настоящие миграции и seed без Docker и без сети.
const client = new PGlite();
const db = drizzle({ client, schema, casing: 'snake_case' });
let stats: SeedStats;

beforeAll(async () => {
  await migrate(db, { migrationsFolder });
  stats = await seedDatabase(db as unknown as SeedDb, DEFAULT_USD_UZS_RATE);
});

afterAll(async () => {
  await client.close();
});

const total = async (table: PgTable) => (await db.select({ n: count() }).from(table))[0]!.n;

describe('seed в Postgres (PGlite)', () => {
  it('заполняет каталог и справочники', async () => {
    expect(stats.products).toBeGreaterThanOrEqual(180);
    expect(await total(schema.products)).toBe(stats.products);
    expect(await total(schema.categories)).toBe(16);
    expect(await total(schema.productTranslations)).toBe(stats.products * 2);
    expect(await total(schema.deliveryZones)).toBe(15);
    expect(await total(schema.prebuiltComponents)).toBe(stats.prebuiltComponents);
    expect(await total(schema.perfGpu)).toBe(stats.perfGpu);
  });

  it('повторный запуск идемпотентен', async () => {
    const again = await seedDatabase(db as unknown as SeedDb, DEFAULT_USD_UZS_RATE);
    expect(again).toEqual(stats);
    expect(await total(schema.products)).toBe(stats.products);
    expect(await total(schema.prebuiltComponents)).toBe(stats.prebuiltComponents);
  });

  it('не перезаписывает переводы, отредактированные вручную', async () => {
    const [product] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, 'amd-ryzen-7-9800x3d'));
    await db
      .update(schema.productTranslations)
      .set({ shortDescription: 'Ручной текст', source: 'human' })
      .where(
        and(
          eq(schema.productTranslations.productId, product!.id),
          eq(schema.productTranslations.locale, 'ru'),
        ),
      );
    await seedDatabase(db as unknown as SeedDb, DEFAULT_USD_UZS_RATE);
    const [row] = await db
      .select({ text: schema.productTranslations.shortDescription })
      .from(schema.productTranslations)
      .where(
        and(
          eq(schema.productTranslations.productId, product!.id),
          eq(schema.productTranslations.locale, 'ru'),
        ),
      );
    expect(row!.text).toBe('Ручной текст');
  });

  it('характеристики в jsonb проходят Zod-схему после чтения', async () => {
    const rows = await db
      .select({ type: schema.products.componentType, specs: schema.products.specs })
      .from(schema.products);
    for (const row of rows) expect(() => parseSpecs(row.type, row.specs)).not.toThrow();
  });

  it('фильтрация по характеристикам в jsonb (как в каталоге)', async () => {
    const am5 = await db
      .select({ n: count() })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.componentType, 'cpu'),
          sql`${schema.products.specs} @> '{"socket":"AM5"}'::jsonb`,
        ),
      );
    expect(am5[0]!.n).toBe(11);

    const longCards = await db
      .select({ n: count() })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.componentType, 'gpu'),
          sql`(${schema.products.specs}->>'lengthMm')::int > 336`,
        ),
      );
    expect(longCards[0]!.n).toBeGreaterThan(0);
  });

  it('цены хранятся в сумах как bigint без потерь', async () => {
    const [row] = await db
      .select({ price: schema.products.priceUzs })
      .from(schema.products)
      .where(eq(schema.products.slug, 'amd-ryzen-7-9800x3d'));
    expect(row!.price).toBe(6_420_000);
  });

  it('курс seed записан в настройки', async () => {
    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'pricing'));
    expect(row!.value).toMatchObject({ usdUzsRate: DEFAULT_USD_UZS_RATE });
  });
});
