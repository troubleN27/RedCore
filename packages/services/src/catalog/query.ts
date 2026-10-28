import {
  sortOptions,
  type CatalogPage,
  type CatalogQuery,
  type CatalogSnapshot,
  type Facet,
  type FilterDefinition,
  type FilterSelection,
  type ProductSummary,
  type RangeValue,
  type SortOption,
} from './types';

export const PAGE_SIZE = 24;

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: Params, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Значение характеристики товара по ключу фильтра (строка для перечислений). */
export function specValue(product: ProductSummary, key: string): unknown {
  return (product.specs as Record<string, unknown>)[key];
}

const toNumber = (value: string | undefined) => {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * URL → состояние каталога. Формат параметров (читаемый и пригодный для SEO-ссылок):
 * перечисление `socket=AM5,AM4`, диапазон `tdpW=65-120` (стороны необязательны: `65-`, `-120`),
 * флаг `integratedGraphics=1`, плюс `sort`, `page`, `stock=1`.
 */
export function parseCatalogQuery(params: Params, definitions: FilterDefinition[]): CatalogQuery {
  const filters: FilterSelection = {};
  for (const def of definitions) {
    const raw = read(params, def.key);
    if (!raw) continue;
    if (def.type === 'enum') {
      const values = raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length > 0) filters[def.key] = [...new Set(values)];
    } else if (def.type === 'range') {
      const [minRaw, maxRaw] = raw.includes('-') ? raw.split('-') : [raw, raw];
      const range: RangeValue = {};
      const min = toNumber(minRaw);
      const max = toNumber(maxRaw);
      if (min !== undefined) range.min = min;
      if (max !== undefined) range.max = max;
      if (range.min !== undefined || range.max !== undefined) filters[def.key] = range;
    } else if (raw === '1' || raw === 'true') {
      filters[def.key] = true;
    }
  }
  const sortRaw = read(params, 'sort');
  const sort = (sortOptions as readonly string[]).includes(sortRaw ?? '')
    ? (sortRaw as SortOption)
    : 'popular';
  const page = Math.max(1, Math.floor(toNumber(read(params, 'page')) ?? 1));
  return { filters, sort, page, inStockOnly: read(params, 'stock') === '1' };
}

/** Состояние каталога → URL-параметры (обратная операция, для ссылок и формы фильтров). */
export function serializeCatalogQuery(query: Partial<CatalogQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query.filters ?? {})) {
    if (value === true) params.set(key, '1');
    else if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else if (value.min !== undefined || value.max !== undefined) {
      params.set(key, `${value.min ?? ''}-${value.max ?? ''}`);
    }
  }
  if (query.inStockOnly) params.set('stock', '1');
  if (query.sort && query.sort !== 'popular') params.set('sort', query.sort);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  return params;
}

function matches(
  product: ProductSummary,
  key: string,
  selection: FilterSelection[string],
): boolean {
  const value = specValue(product, key);
  if (selection === true) return value === true;
  if (Array.isArray(selection)) return value !== undefined && selection.includes(String(value));
  if (typeof value !== 'number') return false;
  return (
    (selection.min === undefined || value >= selection.min) &&
    (selection.max === undefined || value <= selection.max)
  );
}

export function applyFilters(
  items: ProductSummary[],
  filters: FilterSelection,
  inStockOnly: boolean,
  skipKey?: string,
): ProductSummary[] {
  return items.filter(
    (product) =>
      (!inStockOnly || product.available > 0) &&
      Object.entries(filters).every(
        ([key, selection]) => key === skipKey || matches(product, key, selection),
      ),
  );
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function sortProducts(items: ProductSummary[], sort: SortOption): ProductSummary[] {
  const sorted = [...items];
  const inStockFirst = (a: ProductSummary, b: ProductSummary) =>
    Number(b.available > 0) - Number(a.available > 0);
  switch (sort) {
    case 'price-asc':
      return sorted.sort((a, b) => inStockFirst(a, b) || a.priceUzs - b.priceUzs);
    case 'price-desc':
      return sorted.sort((a, b) => inStockFirst(a, b) || b.priceUzs - a.priceUzs);
    case 'name':
      return sorted.sort((a, b) =>
        collator.compare(`${a.brand} ${a.name}`, `${b.brand} ${b.name}`),
      );
    case 'new':
      // Порядок seed соответствует новизне моделей внутри серии; позже — по дате поступления
      return sorted.sort((a, b) => inStockFirst(a, b) || b.sku.localeCompare(a.sku));
    case 'popular':
    default:
      return sorted.sort(
        (a, b) =>
          inStockFirst(a, b) ||
          Number(b.isFeatured) - Number(a.isFeatured) ||
          b.popularity - a.popularity ||
          a.priceUzs - b.priceUzs,
      );
  }
}

/**
 * Фасеты «дизъюнктивно»: счётчики значения учитывают все выбранные фильтры, кроме своего,
 * — так видно, сколько товаров добавит ещё одна галочка в той же группе.
 */
export function buildFacets(
  items: ProductSummary[],
  definitions: FilterDefinition[],
  query: CatalogQuery,
): Facet[] {
  const facets: Facet[] = [];
  for (const def of definitions) {
    const base = applyFilters(items, query.filters, query.inStockOnly, def.key);
    const facet: Facet = {
      key: def.key,
      type: def.type,
      unit: def.unit,
      isCompatibilityKey: def.isCompatibilityKey,
    };
    if (def.type === 'enum') {
      const counts = new Map<string, number>();
      for (const product of items) {
        const value = specValue(product, def.key);
        if (value !== undefined && value !== null) counts.set(String(value), 0);
      }
      for (const product of base) {
        const value = specValue(product, def.key);
        if (value !== undefined && value !== null)
          counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
      }
      facet.values = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => collator.compare(a.value, b.value));
      if (facet.values.length < 2) continue;
    } else if (def.type === 'range') {
      const numbers = items
        .map((p) => specValue(p, def.key))
        .filter((v): v is number => typeof v === 'number');
      if (numbers.length === 0) continue;
      facet.min = Math.min(...numbers);
      facet.max = Math.max(...numbers);
      if (facet.min === facet.max) continue;
    } else {
      facet.trueCount = base.filter((p) => specValue(p, def.key) === true).length;
      if (!items.some((p) => specValue(p, def.key) === true)) continue;
    }
    facets.push(facet);
  }
  return facets;
}

export function listCategoryPage(
  snapshot: CatalogSnapshot,
  categorySlug: string,
  params: Params,
  pageSize = PAGE_SIZE,
): CatalogPage | null {
  const category = snapshot.categories.find((c) => c.slug === categorySlug);
  if (!category) return null;
  const definitions = snapshot.filters.get(categorySlug) ?? [];
  const query = parseCatalogQuery(params, definitions);
  const inCategory = snapshot.products.filter((p) => p.categorySlug === categorySlug);
  const filtered = sortProducts(
    applyFilters(inCategory, query.filters, query.inStockOnly),
    query.sort,
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(query.page, pageCount);
  return {
    category,
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount,
    facets: buildFacets(inCategory, definitions, query),
    query: { ...query, page },
  };
}
