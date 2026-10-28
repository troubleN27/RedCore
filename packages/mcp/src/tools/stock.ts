import type { McpServer } from '@modelcontextprotocol/server';
import { formatPrice } from '@redcore/i18n';
import { adjustStock, AdminValidationError, getDashboard, listLowStock } from '@redcore/services';
import { z } from 'zod';
import type { McpContext } from '../context';
import { defineTool, ToolError } from '../define';
import { snapshotOf } from './catalog';

export function registerStockTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: 'get_stock',
      title: 'Остатки товара',
      description: 'Stock for products by slug or SKU: on hand, reserved by orders, available.',
      scopes: ['stock:read'],
      readOnly: true,
      inputSchema: z.object({ products: z.array(z.string().min(1).max(160)).min(1).max(50) }),
    },
    async ({ products }) => {
      const snapshot = await snapshotOf(ctx);
      return products.map((key) => {
        const p = snapshot.bySlug.get(key) ?? snapshot.products.find((x) => x.sku === key);
        if (!p) return { product: key, found: false };
        return {
          product: key,
          found: true,
          slug: p.slug,
          sku: p.sku,
          name: `${p.brand} ${p.name}`,
          stock: p.stockQty,
          reserved: p.stockQty - p.available,
          available: p.available,
        };
      });
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'low_stock_report',
      title: 'Заканчивающиеся товары',
      description: 'Active products whose available stock is at or below the threshold.',
      scopes: ['stock:read'],
      readOnly: true,
      inputSchema: z.object({ threshold: z.number().int().min(0).max(100).default(3) }),
    },
    async ({ threshold }) => listLowStock(ctx.db, threshold),
  );

  defineTool(
    server,
    ctx,
    {
      name: 'adjust_stock',
      title: 'Корректировка остатка',
      description:
        'Staff only: change on-hand stock by delta (restock > 0, write-off < 0) with a note. ' +
        'Stock cannot drop below reserved quantity. Logged as an inventory movement.',
      scopes: ['stock:write'],
      destructive: true,
      inputSchema: z.object({
        product: z.string().min(1).max(160),
        delta: z.number().int().min(-10_000).max(10_000),
        note: z.string().trim().min(3).max(200),
      }),
    },
    async ({ product, delta, note }) => {
      const snapshot = await snapshotOf(ctx);
      const p = snapshot.bySlug.get(product) ?? snapshot.products.find((x) => x.sku === product);
      if (!p) throw new ToolError('not_found', `Product "${product}" not found`);
      try {
        const { stockQty } = await adjustStock(
          ctx.db,
          p.id,
          delta,
          `MCP (${ctx.actor.label}): ${note}`,
        );
        return { slug: p.slug, sku: p.sku, delta, stock: stockQty };
      } catch (error) {
        if (error instanceof AdminValidationError)
          throw new ToolError('invalid_delta', 'Delta is zero, too large or below reserved stock');
        throw error;
      }
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'sales_report',
      title: 'Отчёт о продажах',
      description:
        'Sales KPIs for the last 7, 30 or 90 days: revenue, orders, average order, paid share, ' +
        'top products, popular builds, configurator funnel and daily series.',
      scopes: ['analytics:read'],
      readOnly: true,
      inputSchema: z.object({ period: z.enum(['d7', 'd30', 'd90']).default('d30') }),
    },
    async ({ period }) => {
      const data = await getDashboard(ctx.db, period);
      return {
        ...data,
        revenue: formatPrice(data.revenueUzs, ctx.locale),
        averageOrder: formatPrice(data.aovUzs, ctx.locale),
      };
    },
  );
}
