import { normalizeSearchText, searchTokens, typeForToken } from '@redcore/domain';
import type { CatalogSnapshot, CategoryInfo, ProductSummary } from './types';

export interface SearchResult {
  query: string;
  items: ProductSummary[];
  total: number;
  /** Категории, на которые указывает запрос («видеокарта», «ssd»…) */
  categories: CategoryInfo[];
}

function score(product: ProductSummary, tokens: string[], normalizedQuery: string): number {
  const title = normalizeSearchText(`${product.brand} ${product.name}`);
  let value = 0;
  if (title.startsWith(normalizedQuery)) value += 6;
  else if (title.includes(normalizedQuery)) value += 4;
  for (const token of tokens) {
    if (title.split(' ').includes(token)) value += 2;
    else if (title.includes(token)) value += 1;
  }
  if (product.available > 0) value += 1.5;
  if (product.isFeatured) value += 0.5;
  return value;
}

/**
 * Поиск по нормализованному тексту товара. Каждое слово запроса должно встретиться
 * (подстрокой, в том числе в слитном написании модели); слова-синонимы категорий
 * («видюха», «videokarta», «ssd») сужают поиск до типа товара.
 */
export function searchCatalog(snapshot: CatalogSnapshot, query: string, limit = 24): SearchResult {
  const tokens = searchTokens(query);
  const typeHints = new Set<string>();
  const textTokens: string[] = [];
  for (const token of tokens) {
    const type = typeForToken(token);
    if (type) typeHints.add(type);
    else textTokens.push(token);
  }

  const categories = snapshot.categories.filter((c) => typeHints.has(c.componentType));
  if (tokens.length === 0) return { query, items: [], total: 0, categories };

  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = textTokens.join('');
  const found = snapshot.products.filter((product) => {
    if (typeHints.size > 0 && !typeHints.has(product.componentType)) return false;
    if (textTokens.length === 0) return true;
    const haystack = product.searchText;
    return (
      textTokens.every((token) => haystack.includes(token)) ||
      (compactQuery.length > 3 && haystack.includes(compactQuery))
    );
  });

  const ranked = found
    .map((product) => ({ product, value: score(product, textTokens, normalizedQuery) }))
    .sort((a, b) => b.value - a.value || a.product.priceUzs - b.product.priceUzs)
    .map(({ product }) => product);

  return { query, items: ranked.slice(0, limit), total: ranked.length, categories };
}
