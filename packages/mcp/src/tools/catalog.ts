import type { McpServer } from '@modelcontextprotocol/server';
import { formatPrice } from '@redcore/i18n';
import {
  getCatalogSnapshot,
  getProductDetail,
  searchCatalog,
  type CatalogSnapshot,
  type ProductSummary,
} from '@redcore/services';
import { z } from 'zod';
import type { McpContext } from '../context';
import { defineTool, ToolError } from '../define';

export function productUrl(ctx: McpContext, slug: string) {
  return `${ctx.siteUrl}/${ctx.locale}/p/${slug}`;
}

/**
 * Карточка товара для модели: только факты из каталога. Цена — числом и строкой на языке
 * клиента, id и slug — чтобы UI рендерил карточку по базе, а не по тексту модели.
 */
export function productCard(ctx: McpContext, p: ProductSummary) {
  return {
    id: p.id,
    slug: p.slug,
    name: `${p.brand} ${p.name}`,
    type: p.componentType,
    category: p.categorySlug,
    priceUzs: p.priceUzs,
    price: formatPrice(p.priceUzs, ctx.locale),
    available: p.available,
    rating: p.ratingCount > 0 ? Math.round(p.ratingAvg * 10) / 10 : null,
    specs: p.specs,
    url: productUrl(ctx, p.slug),
  };
}

export async function snapshotOf(ctx: McpContext): Promise<CatalogSnapshot> {
  return getCatalogSnapshot(ctx.db, ctx.locale);
}

export function registerCatalogTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: 'search_products',
      title: 'Поиск товаров',
      description:
        'Search the RedCore catalog (PC components and peripherals, prices in UZS). ' +
        'Free-text query in Russian, Uzbek or English and/or a category slug or component type ' +
        '(cpu, gpu, motherboard, ram, storage, psu, case, cooler, case_fan, monitor, …). ' +
        'Returns product cards with id, slug, price, stock and specs.',
      scopes: ['catalog:read'],
      readOnly: true,
      inputSchema: z.object({
        query: z.string().trim().max(120).optional(),
        category: z.string().max(40).optional(),
        inStockOnly: z.boolean().default(false),
        maxPriceUzs: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(20).default(8),
      }),
    },
    async ({ query, category, inStockOnly, maxPriceUzs, limit }) => {
      const snapshot = await snapshotOf(ctx);
      let items = query ? searchCatalog(snapshot, query, 100).items : [...snapshot.products];
      if (category)
        items = items.filter((p) => p.categorySlug === category || p.componentType === category);
      if (inStockOnly) items = items.filter((p) => p.available > 0);
      if (maxPriceUzs) items = items.filter((p) => p.priceUzs <= maxPriceUzs);
      if (!query) items.sort((a, b) => b.popularity - a.popularity);
      return { total: items.length, items: items.slice(0, limit).map((p) => productCard(ctx, p)) };
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'get_product',
      title: 'Карточка товара',
      description: 'Full product card by slug: specs, price, stock, description, product URL.',
      scopes: ['catalog:read'],
      readOnly: true,
      inputSchema: z.object({ slug: z.string().min(1).max(160) }),
    },
    async ({ slug }) => {
      const snapshot = await snapshotOf(ctx);
      const detail = await getProductDetail(ctx.db, snapshot, slug);
      if (!detail) throw new ToolError('not_found', `Product "${slug}" not found`);
      return {
        ...productCard(ctx, snapshot.bySlug.get(slug)!),
        category: detail.category,
        description: detail.description ?? detail.shortDescription,
        warrantyMonths: detail.warrantyMonths,
        components: detail.components.map((c) => productCard(ctx, c)),
      };
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'list_categories',
      title: 'Категории каталога',
      description: 'Catalog categories with product counts and minimal prices.',
      scopes: ['catalog:read'],
      readOnly: true,
      inputSchema: z.object({}),
    },
    async () => {
      const snapshot = await snapshotOf(ctx);
      return snapshot.categories.map((c) => ({
        slug: c.slug,
        name: c.name,
        type: c.componentType,
        kind: c.kind,
        products: c.productCount,
        inStock: c.inStockCount,
        fromPrice: c.minPriceUzs === null ? null : formatPrice(c.minPriceUzs, ctx.locale),
      }));
    },
  );
}
