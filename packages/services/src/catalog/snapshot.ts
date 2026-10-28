import {
  brands,
  categories,
  categoryFilters,
  categoryTranslations,
  perfCpu,
  perfGpu,
  prebuiltComponents,
  productTranslations,
  products,
  type Database,
} from '@redcore/db';
import type { AnyCatalogProduct, PerfIndex } from '@redcore/domain';
import type { Locale } from '@redcore/i18n';
import { and, eq } from 'drizzle-orm';
import type { CatalogSnapshot, CategoryInfo, FilterDefinition, ProductSummary } from './types';

// Снимок активного каталога в памяти: ~200 товаров читаются тремя запросами, а фильтрация,
// фасеты, сортировка и поиск считаются в JS поверх снимка. Так один и тот же код обслуживает
// витрину, AI-агентов и MCP. До нескольких тысяч товаров это быстрее SQL с jsonb-условиями;
// при росте каталога фильтрацию можно перенести в SQL — GIN-индекс по specs уже есть.

const TTL_MS = 60_000;
const cache = new Map<Locale, Promise<CatalogSnapshot>>();
let perfCache: Promise<PerfIndex> | undefined;

async function loadSnapshot(db: Database, locale: Locale): Promise<CatalogSnapshot> {
  const [categoryRows, filterRows, productRows, prebuiltRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        slug: categories.slug,
        componentType: categories.componentType,
        kind: categories.kind,
        icon: categories.icon,
        sort: categories.sort,
        name: categoryTranslations.name,
        description: categoryTranslations.description,
      })
      .from(categories)
      .innerJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.locale, locale),
        ),
      )
      .where(eq(categories.isActive, true))
      .orderBy(categories.sort),
    db.select().from(categoryFilters).orderBy(categoryFilters.sort),
    db
      .select({
        product: products,
        brand: brands.name,
        categorySlug: categories.slug,
        shortDescription: productTranslations.shortDescription,
      })
      .from(products)
      .innerJoin(brands, eq(brands.id, products.brandId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(
        productTranslations,
        and(eq(productTranslations.productId, products.id), eq(productTranslations.locale, locale)),
      )
      .where(eq(products.status, 'active')),
    db
      .select({
        prebuiltId: prebuiltComponents.prebuiltId,
        componentId: prebuiltComponents.componentId,
      })
      .from(prebuiltComponents),
  ]);

  const summaries: ProductSummary[] = productRows.map(
    ({ product: p, brand, categorySlug, shortDescription }) => ({
      ...({
        id: p.id,
        sku: p.sku,
        slug: p.slug,
        name: p.name,
        brand,
        componentType: p.componentType,
        priceUzs: p.priceUzs,
        stockQty: p.stockQty,
        specs: p.specs,
        perfKey: p.perfKey,
      } as AnyCatalogProduct),
      categorySlug,
      compareAtPriceUzs: p.compareAtPriceUzs,
      isFeatured: p.isFeatured,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      popularity: p.popularity,
      shortDescription: shortDescription ?? '',
      searchText: p.searchText,
      warrantyMonths: p.warrantyMonths,
      available: Math.max(0, p.stockQty - p.reservedQty),
    }),
  );

  const filters = new Map<string, FilterDefinition[]>();
  const categoryById = new Map(categoryRows.map((c) => [c.id, c.slug]));
  for (const row of filterRows) {
    const slug = categoryById.get(row.categoryId);
    if (!slug) continue;
    const list = filters.get(slug) ?? [];
    list.push({
      key: row.specKey,
      type: row.type,
      unit: row.unit,
      isCompatibilityKey: row.isCompatibilityKey,
    });
    filters.set(slug, list);
  }

  const categoryInfos: CategoryInfo[] = categoryRows.map((c) => {
    const inCategory = summaries.filter((p) => p.categorySlug === c.slug);
    return {
      id: c.id,
      slug: c.slug,
      componentType: c.componentType,
      kind: c.kind,
      icon: c.icon,
      name: c.name,
      description: c.description,
      productCount: inCategory.length,
      inStockCount: inCategory.filter((p) => p.available > 0).length,
      minPriceUzs: inCategory.length > 0 ? Math.min(...inCategory.map((p) => p.priceUzs)) : null,
    };
  });

  const slugById = new Map(summaries.map((p) => [p.id, p.slug]));
  const prebuiltMap = new Map<string, string[]>();
  for (const row of prebuiltRows) {
    const prebuilt = slugById.get(row.prebuiltId);
    const component = slugById.get(row.componentId);
    if (!prebuilt || !component) continue;
    prebuiltMap.set(prebuilt, [...(prebuiltMap.get(prebuilt) ?? []), component]);
  }

  return {
    locale,
    categories: categoryInfos,
    filters,
    products: summaries,
    bySlug: new Map(summaries.map((p) => [p.slug, p])),
    prebuiltComponents: prebuiltMap,
    loadedAt: Date.now(),
  };
}

export async function getCatalogSnapshot(db: Database, locale: Locale): Promise<CatalogSnapshot> {
  const cached = cache.get(locale);
  if (cached) {
    const snapshot = await cached;
    if (Date.now() - snapshot.loadedAt < TTL_MS) return snapshot;
  }
  const next = loadSnapshot(db, locale).catch((error: unknown) => {
    cache.delete(locale);
    throw error;
  });
  cache.set(locale, next);
  return next;
}

export async function getPerfIndex(db: Database): Promise<PerfIndex> {
  perfCache ??= Promise.all([db.select().from(perfGpu), db.select().from(perfCpu)]).then(
    ([gpuRows, cpuRows]) => ({
      gpu: Object.fromEntries(
        gpuRows.map((g) => [
          g.key,
          {
            key: g.key,
            name: g.name,
            vendor: g.vendor,
            index1080: g.index1080,
            index1440: g.index1440,
            index2160: g.index2160,
            frameGen: g.frameGen,
            vramGb: g.vramGb,
          },
        ]),
      ),
      cpu: Object.fromEntries(cpuRows.map((c) => [c.key, c])),
    }),
  );
  return perfCache;
}

/** Сбросить кэш после правок каталога в админке (этап 5). */
export function invalidateCatalogCache(): void {
  cache.clear();
  perfCache = undefined;
}
