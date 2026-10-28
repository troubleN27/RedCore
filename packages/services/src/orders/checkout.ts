import {
  deliveryZones,
  orderItems,
  orderServices,
  orderStatusHistory,
  orders,
  products,
  promoCodes,
  promoRedemptions,
  services,
  type AddressSnapshot,
  type Database,
} from '@redcore/db';
import {
  canOfferAssembly,
  computeQuote,
  normalizePromoCode,
  normalizeUzPhone,
  type PromoError,
  type Quote,
  type QuotePromo,
} from '@redcore/domain';
import type { Locale } from '@redcore/i18n';
import { and, asc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { CatalogSnapshot, ProductSummary } from '../catalog/types';
import { OutOfStockError, reserveStock, type DbOrTx } from './inventory';

export const MAX_CART_QTY = 20;

export type CheckoutErrorCode =
  | 'empty'
  | 'invalid'
  | 'unknown_zone'
  | 'address_required'
  | 'cod_not_allowed'
  | 'card_disabled'
  | 'out_of_stock'
  | 'promo';

export class CheckoutError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
    public readonly details?: string | string[],
  ) {
    super(`Checkout failed: ${code}`);
  }
}

const cartItemsSchema = z
  .array(
    z.object({ slug: z.string().min(1).max(200), qty: z.number().int().min(1).max(MAX_CART_QTY) }),
  )
  .max(60);

export interface ZoneOption {
  id: string;
  code: string;
  name: string;
  priceUzs: number;
  freeFromUzs: number | null;
  etaMinDays: number;
  etaMaxDays: number;
  codAllowed: boolean;
  isPickup: boolean;
}

export interface ServiceOption {
  id: string;
  key: string;
  name: string;
  description: string;
  priceUzs: number;
}

export interface CartLineView {
  product: ProductSummary;
  qty: number;
  totalUzs: number;
  discountUzs: number;
  /** Сколько можно купить сейчас (остаток минус резервы) */
  available: number;
}

export interface CartQuote {
  lines: CartLineView[];
  /** Позиции, которых больше нет в каталоге */
  missing: string[];
  quote: Quote;
  zone: ZoneOption;
  zones: ZoneOption[];
  services: ServiceOption[];
  selectedServices: string[];
  /** Позиции, которых не хватает на складе в нужном количестве */
  shortages: string[];
}

/** Активные зоны доставки и самовывоз на языке пользователя (их же читают MCP и агенты). */
export async function loadZones(db: DbOrTx, locale: Locale): Promise<ZoneOption[]> {
  const rows = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.isActive, true))
    .orderBy(asc(deliveryZones.sort), asc(deliveryZones.code));
  return rows.map((z) => ({
    id: z.id,
    code: z.code,
    name: z.name[locale],
    priceUzs: z.priceUzs,
    freeFromUzs: z.freeFromUzs,
    etaMinDays: z.etaMinDays,
    etaMaxDays: z.etaMaxDays,
    codAllowed: z.codAllowed,
    isPickup: z.isPickup,
  }));
}

async function loadServices(db: DbOrTx, locale: Locale): Promise<ServiceOption[]> {
  const rows = await db.select().from(services).where(eq(services.isActive, true));
  return rows.map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name[locale],
    description: s.description[locale],
    priceUzs: s.priceUzs,
  }));
}

async function loadPromo(
  db: DbOrTx,
  code: string,
  customer: { phone?: string | null; userId?: string | null },
): Promise<{ id: string; promo: QuotePromo; usedByCustomer: number } | null> {
  const [row] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, normalizePromoCode(code)));
  if (!row) return null;
  const who = [
    customer.phone ? eq(promoRedemptions.phone, customer.phone) : undefined,
    customer.userId ? eq(promoRedemptions.userId, customer.userId) : undefined,
  ].filter(Boolean);
  let usedByCustomer = 0;
  if (who.length > 0) {
    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(promoRedemptions)
      .innerJoin(orders, eq(orders.id, promoRedemptions.orderId))
      .where(
        and(eq(promoRedemptions.promoCodeId, row.id), ne(orders.status, 'cancelled'), or(...who)),
      );
    usedByCustomer = count?.n ?? 0;
  }
  return {
    id: row.id,
    usedByCustomer,
    promo: {
      code: row.code,
      type: row.type,
      value: row.value,
      minOrderUzs: row.minOrderUzs,
      maxDiscountUzs: row.maxDiscountUzs,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      usageLimit: row.usageLimit,
      perUserLimit: row.perUserLimit,
      usedCount: row.usedCount,
      appliesTo: row.appliesTo,
      isActive: row.isActive,
    },
  };
}

export interface QuoteCartInput {
  items: { slug: string; qty: number }[];
  zoneCode?: string;
  serviceKeys?: string[];
  promoCode?: string | null;
  phone?: string | null;
  userId?: string | null;
  now?: Date;
}

/** Расчёт корзины для страницы корзины и checkout (по ценам снимка каталога). */
export async function quoteCart(
  db: DbOrTx,
  snapshot: CatalogSnapshot,
  input: QuoteCartInput,
): Promise<CartQuote> {
  const items = cartItemsSchema.parse(input.items);
  const [zones, allServices] = await Promise.all([
    loadZones(db, snapshot.locale),
    loadServices(db, snapshot.locale),
  ]);
  const zone =
    zones.find((z) => z.code === input.zoneCode) ?? zones.find((z) => z.isPickup) ?? zones[0];
  if (!zone) throw new CheckoutError('unknown_zone');

  const missing: string[] = [];
  const found: { product: ProductSummary; qty: number }[] = [];
  for (const item of items) {
    const product = snapshot.bySlug.get(item.slug);
    if (!product || product.componentType === 'prebuilt') missing.push(item.slug);
    else found.push({ product, qty: item.qty });
  }

  const offered = canOfferAssembly(found.map((l) => l.product.componentType)) ? allServices : [];
  const selectedServices = (input.serviceKeys ?? []).filter((key) =>
    offered.some((s) => s.key === key),
  );
  const promo = input.promoCode?.trim()
    ? await loadPromo(db, input.promoCode, { phone: input.phone, userId: input.userId })
    : null;

  const quote = computeQuote({
    lines: found.map((l) => ({
      productId: l.product.id,
      componentType: l.product.componentType,
      priceUzs: l.product.priceUzs,
      qty: l.qty,
    })),
    zone,
    services: offered.filter((s) => selectedServices.includes(s.key)),
    promo: promo?.promo ?? null,
    promoUsedByCustomer: promo?.usedByCustomer ?? 0,
    now: input.now,
  });
  // Неизвестный промокод — тоже ответ для покупателя, а не исключение
  if (input.promoCode?.trim() && !promo) {
    quote.promo = { code: normalizePromoCode(input.promoCode), applied: false, error: 'not_found' };
  }

  const lines = found.map((l, i) => ({
    product: l.product,
    qty: l.qty,
    totalUzs: l.product.priceUzs * l.qty,
    discountUzs: quote.lineDiscounts[i] ?? 0,
    available: l.product.available,
  }));
  return {
    lines,
    missing,
    quote,
    zone,
    zones,
    services: offered,
    selectedServices,
    shortages: lines.filter((l) => l.qty > l.available).map((l) => l.product.slug),
  };
}

// ── Оформление ──

const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeUzPhone(value);
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'phone' });
    return z.NEVER;
  }
  return normalized;
});

export const placeOrderSchema = z.object({
  checkoutAttemptId: z.uuid(),
  items: cartItemsSchema.min(1),
  contact: z.object({
    name: z.string().trim().min(2).max(80),
    phone: phoneSchema,
    email: z
      .email()
      .max(120)
      .optional()
      .or(z.literal('').transform(() => undefined)),
  }),
  zoneCode: z.string().min(1),
  address: z
    .object({
      city: z.string().trim().min(2).max(80),
      district: z.string().trim().max(80).optional(),
      street: z.string().trim().min(2).max(120),
      house: z.string().trim().min(1).max(20),
      apartment: z.string().trim().max(20).optional(),
      landmark: z.string().trim().max(160).optional(),
    })
    .optional(),
  serviceKeys: z.array(z.string()).max(5).default([]),
  promoCode: z.string().max(40).optional(),
  paymentMethod: z.enum(['card', 'cod']),
  comment: z.string().trim().max(500).optional(),
  buildId: z.uuid().optional(),
});
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

export interface PlacedOrder {
  orderId: string;
  number: string;
  accessToken: string;
  paymentMethod: 'card' | 'cod';
  totalUzs: number;
  /** true — заказ с этим checkoutAttemptId уже был создан (повторный клик) */
  reused: boolean;
}

function orderNumber(seq: number, now: Date): string {
  return `RC-${now.getFullYear()}-${String(seq).padStart(6, '0')}`;
}

/**
 * Создаёт заказ: цены и остатки — из БД внутри транзакции, резерв товара,
 * промокод, история статусов. Оплата картой запускается отдельно (startPayment).
 */
export async function placeOrder(
  db: Database,
  snapshot: CatalogSnapshot,
  rawInput: PlaceOrderInput,
  options: {
    userId?: string | null;
    locale: Locale;
    cardEnabled: boolean;
    now?: Date;
    /** Откуда заказ: сайт, AI-ассистент, внешний MCP-клиент, консоль */
    source?: 'web' | 'ai' | 'mcp' | 'admin';
    /** Черновик: без резерва склада, покупатель подтверждает его на странице заказа */
    draft?: boolean;
  },
): Promise<PlacedOrder> {
  const parsed = placeOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new CheckoutError(
      'invalid',
      parsed.error.issues.map((i) => i.path.join('.')),
    );
  }
  const input = parsed.data;
  const now = options.now ?? new Date();

  const [existing] = await db
    .select({
      id: orders.id,
      number: orders.number,
      accessToken: orders.accessToken,
      paymentMethod: orders.paymentMethod,
      totalUzs: orders.totalUzs,
    })
    .from(orders)
    .where(eq(orders.checkoutAttemptId, input.checkoutAttemptId));
  if (existing) return { orderId: existing.id, ...existing, reused: true };

  if (input.paymentMethod === 'card' && !options.cardEnabled)
    throw new CheckoutError('card_disabled');

  return db
    .transaction(async (tx) => {
      const zones = await loadZones(tx, options.locale);
      const zone = zones.find((z) => z.code === input.zoneCode);
      if (!zone) throw new CheckoutError('unknown_zone');
      if (!zone.isPickup && !input.address) throw new CheckoutError('address_required');
      if (input.paymentMethod === 'cod' && !zone.codAllowed)
        throw new CheckoutError('cod_not_allowed');

      // Актуальные цены и статусы — из БД, не из кэша каталога и не от клиента
      const slugs = input.items.map((i) => i.slug);
      const rows = await tx
        .select({
          id: products.id,
          slug: products.slug,
          sku: products.sku,
          priceUzs: products.priceUzs,
          componentType: products.componentType,
          status: products.status,
        })
        .from(products)
        .where(inArray(products.slug, slugs));
      const bySlug = new Map(rows.map((r) => [r.slug, r]));
      const unknown = slugs.filter((slug) => bySlug.get(slug)?.status !== 'active');
      if (unknown.length > 0) throw new CheckoutError('out_of_stock', unknown);
      const lines = input.items.map((item) => ({ row: bySlug.get(item.slug)!, qty: item.qty }));

      const offered = canOfferAssembly(lines.map((l) => l.row.componentType))
        ? await loadServices(tx, options.locale)
        : [];
      const chosen = offered.filter((s) => input.serviceKeys.includes(s.key));
      const promo = input.promoCode?.trim()
        ? await loadPromo(tx, input.promoCode, {
            phone: input.contact.phone,
            userId: options.userId,
          })
        : null;
      if (input.promoCode?.trim() && !promo)
        throw new CheckoutError('promo', 'not_found' satisfies PromoError);

      const quote = computeQuote({
        lines: lines.map((l) => ({
          productId: l.row.id,
          componentType: l.row.componentType,
          priceUzs: l.row.priceUzs,
          qty: l.qty,
        })),
        zone,
        services: chosen,
        promo: promo?.promo ?? null,
        promoUsedByCustomer: promo?.usedByCustomer ?? 0,
        now,
      });
      if (quote.promo && !quote.promo.applied) throw new CheckoutError('promo', quote.promo.error);

      // pg и PGlite возвращают результат execute одинаково — { rows }
      const sequence = (await tx.execute(
        sql`select nextval('order_number_seq')::int as seq`,
      )) as unknown as {
        rows: [{ seq: number }];
      };
      const seq = sequence.rows[0].seq;
      const address: AddressSnapshot | null =
        zone.isPickup || !input.address
          ? null
          : { recipient: input.contact.name, phone: input.contact.phone, ...input.address };

      const [order] = await tx
        .insert(orders)
        .values({
          number: orderNumber(seq, now),
          userId: options.userId ?? null,
          accessToken: randomBytes(18).toString('base64url'),
          checkoutAttemptId: input.checkoutAttemptId,
          contactName: input.contact.name,
          contactPhone: input.contact.phone,
          contactEmail: input.contact.email ?? null,
          locale: options.locale,
          status: options.draft ? 'draft' : 'created',
          paymentStatus: 'unpaid',
          paymentMethod: input.paymentMethod,
          source: options.source ?? 'web',
          subtotalUzs: quote.subtotalUzs,
          discountUzs: quote.discountUzs,
          deliveryUzs: quote.deliveryUzs,
          servicesUzs: quote.servicesUzs,
          totalUzs: quote.totalUzs,
          promoCodeId: promo && quote.promo?.applied ? promo.id : null,
          zoneId: zone.id,
          addressSnapshot: address,
          comment: input.comment || null,
          buildId: input.buildId ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const created = order!;

      if (!options.draft) {
        await reserveStock(
          tx,
          created.id,
          lines.map((l) => ({ productId: l.row.id, qty: l.qty })),
        );
      }

      await tx.insert(orderItems).values(
        lines.map((l, i) => {
          const summary = snapshot.bySlug.get(l.row.slug);
          return {
            orderId: created.id,
            productId: l.row.id,
            sku: l.row.sku,
            name: summary ? `${summary.brand} ${summary.name}` : l.row.sku,
            componentType: l.row.componentType,
            priceUzs: l.row.priceUzs,
            discountUzs: quote.lineDiscounts[i] ?? 0,
            qty: l.qty,
          };
        }),
      );
      if (chosen.length > 0) {
        const serviceRows = await tx
          .select()
          .from(services)
          .where(
            inArray(
              services.key,
              chosen.map((s) => s.key),
            ),
          );
        await tx.insert(orderServices).values(
          serviceRows.map((s) => ({
            orderId: created.id,
            serviceId: s.id,
            key: s.key,
            name: s.name,
            priceUzs: s.priceUzs,
          })),
        );
      }
      if (promo && quote.promo?.applied) {
        // Общий лимит использований проверяется атомарно — как и остатки
        const bumped = await tx
          .update(promoCodes)
          .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
          .where(
            and(
              eq(promoCodes.id, promo.id),
              or(isNull(promoCodes.usageLimit), lt(promoCodes.usedCount, promoCodes.usageLimit)),
            ),
          )
          .returning({ id: promoCodes.id });
        if (bumped.length === 0)
          throw new CheckoutError('promo', 'usage_limit' satisfies PromoError);
        await tx.insert(promoRedemptions).values({
          promoCodeId: promo.id,
          orderId: created.id,
          userId: options.userId ?? null,
          phone: input.contact.phone,
        });
      }
      await tx.insert(orderStatusHistory).values({
        orderId: created.id,
        fromStatus: null,
        toStatus: options.draft ? 'draft' : 'created',
        paymentStatus: 'unpaid',
        actorType: options.draft ? 'agent' : 'customer',
        actorId: options.userId ?? null,
        createdAt: now,
      });

      return {
        orderId: created.id,
        number: created.number,
        accessToken: created.accessToken,
        paymentMethod: created.paymentMethod,
        totalUzs: created.totalUzs,
        reused: false,
      };
    })
    .catch((error: unknown) => {
      if (error instanceof OutOfStockError) {
        const slugById = new Map(snapshot.products.map((p) => [p.id, p.slug]));
        throw new CheckoutError(
          'out_of_stock',
          error.productIds.map((id) => slugById.get(id) ?? id),
        );
      }
      throw error;
    });
}
