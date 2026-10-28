import type { AnyCatalogProduct, PcComponentType } from '@redcore/domain';
import type { ProductSummary } from '@redcore/services';

/** Порядок шагов конфигуратора: от корпуса к вентиляторам (выбирать можно в любом порядке). */
export const stepOrder = [
  'case',
  'motherboard',
  'cpu',
  'cooler',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case_fan',
] as const satisfies readonly PcComponentType[];

/** Товар в конфигураторе: всё, что нужно движку совместимости и карточке, без описаний. */
export type ConfigProduct = AnyCatalogProduct & {
  categorySlug: string;
  compareAtPriceUzs: number | null;
  popularity: number;
  available: number;
};

export interface BuildItem {
  slot: PcComponentType;
  slug: string;
  qty: number;
}

export function toConfigProduct(p: ProductSummary): ConfigProduct {
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    componentType: p.componentType,
    priceUzs: p.priceUzs,
    stockQty: p.stockQty,
    specs: p.specs,
    perfKey: p.perfKey ?? null,
    categorySlug: p.categorySlug,
    compareAtPriceUzs: p.compareAtPriceUzs,
    popularity: p.popularity,
    available: p.available,
  } as ConfigProduct;
}

export function pdfUrl(publicId: string, locale: string) {
  return `/api/builds/${publicId}/pdf?locale=${locale}`;
}
