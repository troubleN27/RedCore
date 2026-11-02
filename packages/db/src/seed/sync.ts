import { eq, sql } from 'drizzle-orm';
import * as schema from '../schema';
import { buildSeedCatalog, searchTextFor } from './catalog';
import { categories as categorySeeds } from './data/categories';
import { seedRate } from './pricing';
import type { SeedDb } from './seed';

const excluded = (column: string) => sql.raw(`excluded."${column}"`);

export interface CatalogSyncStats {
  categoriesAdded: string[];
  productsAdded: number;
  productsMoved: string[];
}

/**
 * Обновление каталога рабочей базы без потери правок магазина:
 * разделы, их названия и фильтры — как в демо-данных; новые бренды и товары — добавляются;
 * у уже существующих товаров меняется только раздел (если его перенесли), а цены, остатки,
 * характеристики, тексты и скидки остаются как есть.
 */
export async function syncCatalog(db: SeedDb, rate = seedRate()): Promise<CatalogSyncStats> {
  const { products } = buildSeedCatalog(rate);

  return db.transaction(async (tx) => {
    const before = new Set(
      (await tx.select({ slug: schema.categories.slug }).from(schema.categories)).map(
        (r) => r.slug,
      ),
    );

    // ── Разделы, переводы и фильтры ──
    const categoryRows = await tx
      .insert(schema.categories)
      .values(
        categorySeeds.map((c, index) => ({
          slug: c.slug,
          kind: c.kind,
          componentType: c.type,
          sort: index,
          icon: c.icon,
        })),
      )
      .onConflictDoUpdate({
        target: schema.categories.slug,
        set: {
          kind: excluded('kind'),
          componentType: excluded('component_type'),
          sort: excluded('sort'),
          icon: excluded('icon'),
        },
      })
      .returning({ id: schema.categories.id, slug: schema.categories.slug });
    const categoryId = new Map(categoryRows.map((row) => [row.slug, row.id]));

    await tx
      .insert(schema.categoryTranslations)
      .values(
        categorySeeds.flatMap((c) =>
          (['ru', 'uz'] as const).map((locale) => ({
            categoryId: categoryId.get(c.slug)!,
            locale,
            name: c[locale].name,
            description: c[locale].description,
          })),
        ),
      )
      .onConflictDoUpdate({
        target: [schema.categoryTranslations.categoryId, schema.categoryTranslations.locale],
        set: { name: excluded('name'), description: excluded('description') },
      });

    await tx
      .insert(schema.categoryFilters)
      .values(
        categorySeeds.flatMap((c) =>
          c.filters.map((f, sort) => ({
            categoryId: categoryId.get(c.slug)!,
            specKey: f.key,
            type: f.type,
            unit: f.unit ?? null,
            sort,
            isCompatibilityKey: f.compat ?? false,
          })),
        ),
      )
      .onConflictDoUpdate({
        target: [schema.categoryFilters.categoryId, schema.categoryFilters.specKey],
        set: {
          type: excluded('type'),
          unit: excluded('unit'),
          sort: excluded('sort'),
          isCompatibilityKey: excluded('is_compatibility_key'),
        },
      });

    // ── Бренды: только новые ──
    const slugOf = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    await tx
      .insert(schema.brands)
      .values(
        [...new Set(products.map((p) => p.brand))].map((name) => ({ slug: slugOf(name), name })),
      )
      .onConflictDoNothing({ target: schema.brands.slug });
    const brandId = new Map(
      (await tx.select({ id: schema.brands.id, name: schema.brands.name }).from(schema.brands)).map(
        (b) => [b.name, b.id],
      ),
    );

    // ── Товары ──
    const existing = new Map(
      (
        await tx
          .select({ slug: schema.products.slug, categoryId: schema.products.categoryId })
          .from(schema.products)
      ).map((row) => [row.slug, row.categoryId]),
    );
    // Готовые сборки ведут свой состав — синхронизация их не добавляет
    const fresh = products.filter((p) => !existing.has(p.slug) && !p.components);
    let productsAdded = 0;
    if (fresh.length > 0) {
      const inserted = await tx
        .insert(schema.products)
        .values(
          fresh.map((p) => ({
            sku: p.sku,
            slug: p.slug,
            categoryId: categoryId.get(p.categorySlug)!,
            brandId: brandId.get(p.brand)!,
            componentType: p.componentType,
            name: p.name,
            status: 'active' as const,
            priceUzs: p.priceUzs,
            compareAtPriceUzs: p.compareAtPriceUzs,
            stockQty: p.stockQty,
            warrantyMonths: p.warrantyMonths,
            specs: p.specs,
            perfKey: p.perfKey ?? null,
            searchText: searchTextFor(p),
            isFeatured: p.featured,
          })),
        )
        .onConflictDoNothing({ target: schema.products.slug })
        .returning({ id: schema.products.id, slug: schema.products.slug });
      productsAdded = inserted.length;
      const bySlug = new Map(fresh.map((p) => [p.slug, p]));
      if (inserted.length > 0) {
        await tx
          .insert(schema.productTranslations)
          .values(
            inserted.flatMap((row) =>
              (['ru', 'uz'] as const).map((locale) => ({
                productId: row.id,
                locale,
                shortDescription: bySlug.get(row.slug)!.shortDescription[locale],
                source: 'template' as const,
              })),
            ),
          )
          .onConflictDoNothing();
      }
    }

    // Товары, которые перенесли в другой раздел (например, офисный монитор из игровых)
    const productsMoved: string[] = [];
    for (const p of products) {
      const current = existing.get(p.slug);
      const target = categoryId.get(p.categorySlug);
      if (current && target && current !== target) {
        await tx
          .update(schema.products)
          .set({ categoryId: target, updatedAt: sql`now()` })
          .where(eq(schema.products.slug, p.slug));
        productsMoved.push(p.slug);
      }
    }

    return {
      categoriesAdded: categorySeeds.map((c) => c.slug).filter((slug) => !before.has(slug)),
      productsAdded,
      productsMoved,
    };
  });
}
