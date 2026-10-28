import { productTranslations, products, type Database } from '@redcore/db';
import {
  checkCandidate,
  emptyBuild,
  pcComponentTypes,
  placeProduct,
  type AnyCatalogProduct,
  type ComponentType,
  type PcComponentType,
  type PerfIndex,
} from '@redcore/domain';
import type { Locale } from '@redcore/i18n';
import { and, eq } from 'drizzle-orm';
import { sortProducts } from './query';
import type { CatalogSnapshot, ProductDetail, ProductSummary } from './types';

export async function getProductDetail(
  db: Database,
  snapshot: CatalogSnapshot,
  slug: string,
): Promise<ProductDetail | null> {
  const summary = snapshot.bySlug.get(slug);
  if (!summary) return null;
  const category = snapshot.categories.find((c) => c.slug === summary.categorySlug)!;
  const [translation] = await db
    .select({
      description: productTranslations.description,
      seoTitle: productTranslations.seoTitle,
      seoDescription: productTranslations.seoDescription,
    })
    .from(productTranslations)
    .innerJoin(products, eq(products.id, productTranslations.productId))
    .where(and(eq(products.slug, slug), eq(productTranslations.locale, snapshot.locale as Locale)));

  const [model] = await db
    .select({ model3d: products.model3d })
    .from(products)
    .where(eq(products.slug, slug));
  const { searchText: _searchText, ...rest } = summary;
  return {
    ...rest,
    category: { slug: category.slug, name: category.name },
    description: translation?.description ?? null,
    seoTitle: translation?.seoTitle ?? null,
    seoDescription: translation?.seoDescription ?? null,
    model3d: model?.model3d
      ? { baseKey: model.model3d.baseKey, customUrl: model.model3d.customUrl }
      : null,
    components: (snapshot.prebuiltComponents.get(slug) ?? [])
      .map((componentSlug) => snapshot.bySlug.get(componentSlug))
      .filter((p): p is ProductSummary => Boolean(p)),
  };
}

export function getProductsBySlugs(snapshot: CatalogSnapshot, slugs: string[]): ProductSummary[] {
  return slugs
    .map((slug) => snapshot.bySlug.get(slug))
    .filter((p): p is ProductSummary => Boolean(p));
}

/** Что докупить к этому товару: какие типы совместимы по смыслу (CPU → плата, кулер, память…). */
const companionTypes: Partial<Record<ComponentType, PcComponentType[]>> = {
  cpu: ['motherboard', 'cooler', 'ram'],
  motherboard: ['cpu', 'ram', 'storage', 'case'],
  ram: ['motherboard', 'cpu'],
  gpu: ['psu', 'case'],
  psu: ['gpu', 'case'],
  case: ['motherboard', 'gpu', 'cooler', 'psu', 'case_fan'],
  cooler: ['cpu', 'case'],
  storage: ['motherboard'],
  case_fan: ['case'],
};

export interface CompatibleGroup {
  componentType: PcComponentType;
  items: ProductSummary[];
  total: number;
}

/**
 * «С этим совместимо»: для каждого подходящего типа — товары в наличии, которые не дают
 * ошибок совместимости с текущим товаром (проверка тем же движком, что и в конфигураторе).
 */
export function getCompatibleProducts(
  snapshot: CatalogSnapshot,
  perf: PerfIndex,
  product: ProductSummary,
  limit = 4,
): CompatibleGroup[] {
  const types = companionTypes[product.componentType];
  if (!types || !(pcComponentTypes as readonly string[]).includes(product.componentType)) return [];
  const build = placeProduct(emptyBuild(), product as AnyCatalogProduct);
  return types
    .map((componentType) => {
      const candidates = snapshot.products.filter(
        (p) => p.componentType === componentType && p.available > 0,
      );
      const compatible = candidates.filter(
        (candidate) => checkCandidate(build, candidate as AnyCatalogProduct, perf).compatible,
      );
      return {
        componentType,
        items: sortProducts(compatible, 'popular').slice(0, limit),
        total: compatible.length,
      };
    })
    .filter((group) => group.items.length > 0);
}

/** Похожие товары: та же категория, ближе всего по цене. */
export function getSimilarProducts(
  snapshot: CatalogSnapshot,
  product: ProductSummary,
  limit = 4,
): ProductSummary[] {
  return snapshot.products
    .filter((p) => p.categorySlug === product.categorySlug && p.slug !== product.slug)
    .sort(
      (a, b) => Math.abs(a.priceUzs - product.priceUzs) - Math.abs(b.priceUzs - product.priceUzs),
    )
    .slice(0, limit);
}

export function getFeaturedProducts(snapshot: CatalogSnapshot, limit = 8): ProductSummary[] {
  return sortProducts(
    snapshot.products.filter((p) => p.isFeatured && p.componentType !== 'prebuilt'),
    'popular',
  ).slice(0, limit);
}

export function getPrebuilts(snapshot: CatalogSnapshot): ProductSummary[] {
  return snapshot.products
    .filter((p) => p.componentType === 'prebuilt')
    .sort((a, b) => a.priceUzs - b.priceUzs);
}
