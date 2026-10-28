import type { McpServer } from '@modelcontextprotocol/server';
import {
  analyzeBuild,
  checkCandidate,
  gpuIndexFor,
  resolutions,
  type AnyCatalogProduct,
  type PcComponentType,
  type PerfIndex,
} from '@redcore/domain';
import { formatPrice } from '@redcore/i18n';
import { getTranslator } from '@redcore/i18n/translator';
import {
  createSupportTicket,
  getPerfIndex,
  listUserOrders,
  loadZones,
  purchaseRecommendations,
} from '@redcore/services';
import { z } from 'zod';
import type { McpContext } from '../context';
import { defineTool, ToolError } from '../define';
import { buildFromItems, itemsSchema } from './builds';
import { productCard, snapshotOf } from './catalog';

// Инструменты агентов поддержки, проверки сборки и админ-агента (план, §8).

const translator = (ctx: McpContext) =>
  getTranslator(ctx.locale) as unknown as (key: string, params?: object) => string;

/** Производительность детали для сравнения альтернатив (GPU и CPU — по индексам, прочее — по цене). */
function perfScore(product: AnyCatalogProduct, perf: PerfIndex): number | null {
  if (product.componentType === 'gpu') {
    const p = perf.gpu[product.specs.chip];
    return p ? gpuIndexFor(p, '1440p') : null;
  }
  if (product.componentType === 'cpu')
    return product.perfKey ? (perf.cpu[product.perfKey]?.gamingIndex ?? null) : null;
  return null;
}

export function registerAgentTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: 'get_my_orders',
      title: 'Мои заказы',
      description:
        "The signed-in customer's orders: number, status, payment, total, date. Guests must use get_order_status with a phone.",
      scopes: ['orders:read:own', 'orders:read'],
      readOnly: true,
      inputSchema: z.object({}),
    },
    async () => {
      if (!ctx.actor.userId)
        throw new ToolError(
          'sign_in_required',
          'Customer is not signed in; ask for the order number and phone',
        );
      const list = await listUserOrders(ctx.db, ctx.actor.userId);
      return list.slice(0, 20).map((o) => ({
        number: o.number,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: formatPrice(o.totalUzs, ctx.locale),
        items: o.itemCount,
        createdAt: o.createdAt.toISOString(),
      }));
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'get_policy',
      title: 'Правила магазина',
      description:
        'Store policy text in the customer language: delivery (with zones and prices), payment, warranty or returns.',
      scopes: ['catalog:read'],
      readOnly: true,
      inputSchema: z.object({ topic: z.enum(['delivery', 'payment', 'warranty', 'returns']) }),
    },
    async ({ topic }) => {
      const t = translator(ctx);
      const result: Record<string, unknown> = {
        topic,
        title: t(`policies.${topic}.title`),
        text: t(`policies.${topic}.text`),
      };
      if (topic === 'delivery') {
        result.zones = (await loadZones(ctx.db, ctx.locale)).map((z) => ({
          name: z.name,
          price: formatPrice(z.priceUzs, ctx.locale),
          days: `${z.etaMinDays}–${z.etaMaxDays}`,
          freeFrom: z.freeFromUzs ? formatPrice(z.freeFromUzs, ctx.locale) : null,
          cashOnDelivery: z.codAllowed,
        }));
      }
      return result;
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'create_support_ticket',
      title: 'Обращение к оператору',
      description:
        'Hand the case over to a human: creates a support ticket with topic, message, optional order number and contact.',
      scopes: ['support:write'],
      inputSchema: z.object({
        topic: z.enum(['order', 'warranty', 'return', 'payment', 'delivery', 'other']),
        message: z.string().min(5).max(1000),
        orderNumber: z.string().max(20).optional(),
        contactName: z.string().max(80).optional(),
        contactPhone: z.string().max(30).optional(),
      }),
    },
    async (input) => {
      if (!ctx.actor.userId && !input.contactPhone)
        throw new ToolError('contact_required', 'Ask the guest for a phone number to contact them');
      const ticket = await createSupportTicket(ctx.db, {
        ...input,
        userId: ctx.actor.userId,
        locale: ctx.locale,
      });
      return { ticket: ticket.number, status: 'open' };
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'analyze_build',
      title: 'Анализ баланса сборки',
      description:
        'Deterministic balance analysis of a build: CPU/GPU bottlenecks, PSU headroom, memory channels and size, VRAM ' +
        'for resolution, budget distribution, storage. Each finding has a localized message and a fix hint (slot + cheaper/faster).',
      scopes: ['builds:read'],
      readOnly: true,
      inputSchema: z.object({
        items: itemsSchema,
        resolution: z.enum(resolutions).default('1440p'),
        purpose: z.enum(['gaming', 'workstation']).default('gaming'),
      }),
    },
    async ({ items, resolution, purpose }) => {
      const { build } = await buildFromItems(ctx, items);
      const t = translator(ctx);
      return analyzeBuild(build, await getPerfIndex(ctx.db), { resolution, purpose }).map((f) => ({
        ...f,
        message: t(`compat.analysis.${f.code}`, f.params),
      }));
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'suggest_alternatives',
      title: 'Альтернативы детали',
      description:
        'In-stock alternatives for one slot of a build that stay compatible: cheaper (keeping performance as high as ' +
        'possible) or faster (cheapest upgrade first). Returns price delta and performance index delta for GPU/CPU.',
      scopes: ['builds:read'],
      readOnly: true,
      inputSchema: z.object({
        items: itemsSchema,
        slot: z.enum(['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler']),
        direction: z.enum(['cheaper', 'faster']),
        limit: z.number().int().min(1).max(5).default(3),
      }),
    },
    async ({ items, slot, direction, limit }) => {
      const [{ build }, snapshot, perf] = await Promise.all([
        buildFromItems(ctx, items),
        snapshotOf(ctx),
        getPerfIndex(ctx.db),
      ]);
      const current = (build as unknown as Record<string, unknown>)[slot] as
        AnyCatalogProduct | undefined;
      const currentLine = Array.isArray(current) ? undefined : current;
      const currentPrice = currentLine?.priceUzs ?? 0;
      const currentPerf = currentLine ? perfScore(currentLine, perf) : null;
      const candidates = snapshot.products
        .filter(
          (p) =>
            p.componentType === (slot as PcComponentType) &&
            p.available > 0 &&
            p.id !== currentLine?.id,
        )
        .filter((p) => checkCandidate(build, p, perf).compatible)
        .map((p) => ({ p, score: perfScore(p, perf) }));
      const ordered =
        direction === 'cheaper'
          ? candidates
              .filter((c) => c.p.priceUzs < currentPrice || !currentLine)
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.p.priceUzs - a.p.priceUzs)
          : candidates
              .filter((c) =>
                currentPerf === null ? c.p.priceUzs > currentPrice : (c.score ?? 0) > currentPerf,
              )
              .sort((a, b) => a.p.priceUzs - b.p.priceUzs);
      return {
        current: currentLine
          ? { slug: currentLine.slug, name: `${currentLine.brand} ${currentLine.name}` }
          : null,
        alternatives: ordered.slice(0, limit).map(({ p, score }) => ({
          ...productCard(ctx, p),
          priceDeltaUzs: p.priceUzs - currentPrice,
          priceDelta: formatPrice(p.priceUzs - currentPrice, ctx.locale),
          perfDeltaPercent:
            score !== null && currentPerf
              ? Math.round(((score - currentPerf) / currentPerf) * 100)
              : null,
        })),
      };
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'purchase_recommendations',
      title: 'Рекомендации по закупке',
      description:
        'Deterministic restock plan: sales velocity over 30/90 days, lead time and safety stock give the reorder point ' +
        'and the quantity to order for the next 30 days. Sorted by days of stock left.',
      scopes: ['analytics:read'],
      readOnly: true,
      inputSchema: z.object({
        leadTimeDays: z.number().int().min(1).max(60).default(7),
        limit: z.number().int().min(1).max(50).default(15),
      }),
    },
    async ({ leadTimeDays, limit }) => purchaseRecommendations(ctx.db, { leadTimeDays, limit }),
  );
}
