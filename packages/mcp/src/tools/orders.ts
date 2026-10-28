import type { McpServer } from '@modelcontextprotocol/server';
import { normalizeUzPhone, orderStatuses } from '@redcore/domain';
import { formatPrice } from '@redcore/i18n';
import {
  adminTransitionOrder,
  CheckoutError,
  getOrderByNumber,
  loadZones,
  OrderTransitionError,
  placeOrder,
  type OrderView,
} from '@redcore/services';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hasScope, type McpContext } from '../context';
import { defineTool, ToolError } from '../define';
import { itemsSchema } from './builds';
import { snapshotOf } from './catalog';

const numberSchema = z
  .string()
  .trim()
  .regex(/^RC-\d{4}-\d{6}$/, 'RC-YYYY-NNNNNN');

/**
 * Доступ к заказу. orders:read — любой (персонал); orders:read:own — только свой заказ
 * (по пользователю ключа) или гостевой, если клиент подтвердил телефон из заказа.
 * Чужой номер и несуществующий отвечают одинаково — по ответу нельзя перебирать номера.
 */
async function readableOrder(ctx: McpContext, number: string, phone?: string): Promise<OrderView> {
  const view = await getOrderByNumber(ctx.db, number);
  const denied = new ToolError('not_found', `Order ${number} not found or access denied`);
  if (!view) throw denied;
  if (hasScope(ctx, 'orders:read')) return view;
  const own = ctx.actor.userId !== null && view.order.userId === ctx.actor.userId;
  const phoneOk = Boolean(phone && normalizeUzPhone(phone) === view.order.contactPhone);
  if (!own && !phoneOk) throw denied;
  return view;
}

function describeOrder(ctx: McpContext, view: OrderView) {
  const { order } = view;
  return {
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    source: order.source,
    totalUzs: order.totalUzs,
    total: formatPrice(order.totalUzs, ctx.locale),
    delivery: view.zone.name[ctx.locale],
    createdAt: order.createdAt.toISOString(),
    items: view.items.map((i) => ({
      name: i.name,
      sku: i.sku,
      qty: i.qty,
      price: formatPrice(i.priceUzs, ctx.locale),
    })),
    history: view.history.map((h) => ({ status: h.toStatus, at: h.createdAt.toISOString() })),
  };
}

export function registerOrderTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: 'get_order_status',
      title: 'Статус заказа',
      description:
        'Order status, payment, items and status history by order number (RC-YYYY-NNNNNN). ' +
        'Customers can see only their own orders; a guest confirms ownership with the phone ' +
        'number used in the order.',
      scopes: ['orders:read:own', 'orders:read'],
      readOnly: true,
      inputSchema: z.object({ number: numberSchema, phone: z.string().max(30).optional() }),
    },
    async ({ number, phone }) => describeOrder(ctx, await readableOrder(ctx, number, phone)),
  );

  defineTool(
    server,
    ctx,
    {
      name: 'get_delivery_options',
      title: 'Доставка',
      description:
        'Delivery zones (14 regions of Uzbekistan and store pickup): price, free-from threshold, ' +
        'delivery time and cash-on-delivery availability. Zone codes are used by create_draft_order.',
      scopes: ['catalog:read', 'orders:write:own', 'orders:write'],
      readOnly: true,
      inputSchema: z.object({}),
    },
    async () =>
      (await loadZones(ctx.db, ctx.locale)).map((z) => ({
        code: z.code,
        name: z.name,
        price: formatPrice(z.priceUzs, ctx.locale),
        freeFrom: z.freeFromUzs === null ? null : formatPrice(z.freeFromUzs, ctx.locale),
        days: [z.etaMinDays, z.etaMaxDays],
        cashOnDelivery: z.codAllowed,
        pickup: z.isPickup,
      })),
  );

  defineTool(
    server,
    ctx,
    {
      name: 'create_draft_order',
      title: 'Черновик заказа',
      description:
        'Create a DRAFT order from product slugs. Stock is not reserved and nothing is charged: ' +
        'the customer opens the returned link, reviews and confirms the order, then pays by card ' +
        'or chooses cash on delivery. Prices are always taken from the database.',
      scopes: ['orders:write:own', 'orders:write'],
      inputSchema: z.object({
        items: itemsSchema,
        contact: z.object({
          name: z.string().min(2).max(80),
          phone: z.string().max(30),
        }),
        zoneCode: z.string().min(1).max(40),
        address: z
          .object({
            city: z.string().min(2).max(80),
            district: z.string().max(80).optional(),
            street: z.string().min(2).max(120),
            house: z.string().min(1).max(20),
            apartment: z.string().max(20).optional(),
            landmark: z.string().max(160).optional(),
          })
          .optional(),
        paymentMethod: z.enum(['card', 'cod']),
        comment: z.string().max(500).optional(),
      }),
    },
    async (input) => {
      const snapshot = await snapshotOf(ctx);
      try {
        const placed = await placeOrder(
          ctx.db,
          snapshot,
          { ...input, checkoutAttemptId: randomUUID(), serviceKeys: [] },
          {
            userId: ctx.actor.userId,
            locale: ctx.locale,
            cardEnabled: ctx.cardEnabled,
            source: ctx.source === 'agent' ? 'ai' : 'mcp',
            draft: true,
          },
        );
        return {
          number: placed.number,
          status: 'draft',
          totalUzs: placed.totalUzs,
          total: formatPrice(placed.totalUzs, ctx.locale),
          paymentMethod: placed.paymentMethod,
          confirmUrl: `${ctx.siteUrl}/${ctx.locale}/orders/${placed.number}?token=${placed.accessToken}`,
          note: 'Draft only: stock is reserved after the customer confirms the order via confirmUrl.',
        };
      } catch (error) {
        if (error instanceof CheckoutError) {
          const details = Array.isArray(error.details) ? error.details.join(', ') : error.details;
          throw new ToolError(error.code, `${error.code}${details ? `: ${details}` : ''}`);
        }
        throw error;
      }
    },
  );

  defineTool(
    server,
    ctx,
    {
      name: 'update_order_status',
      title: 'Смена статуса заказа',
      description:
        'Staff only: move an order to the next status (assembling, shipped, delivered, ' +
        'cancelled) following the order state machine. Every change is written to order history.',
      scopes: ['orders:write'],
      destructive: true,
      inputSchema: z.object({
        number: numberSchema,
        to: z.enum(orderStatuses),
        note: z.string().max(300).optional(),
      }),
    },
    async ({ number, to, note }) => {
      const view = await getOrderByNumber(ctx.db, number);
      if (!view) throw new ToolError('not_found', `Order ${number} not found`);
      try {
        const actorId = ctx.actor.userId ?? `api_key:${ctx.actor.apiKeyId ?? ctx.actor.label}`;
        const { from } = await adminTransitionOrder(ctx.db, view.order.id, to, actorId, note);
        return { number, from, to };
      } catch (error) {
        if (error instanceof OrderTransitionError)
          throw new ToolError('invalid_transition', error.message);
        throw error;
      }
    },
  );
}
