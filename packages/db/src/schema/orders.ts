import { orderStatuses, paymentStatuses } from '@redcore/domain';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { builds } from './builds';
import { products, type LocalizedText } from './catalog';
import { deliveryZones, promoCodes, services } from './commerce';

// ── Адреса, корзина, избранное ──

export const addresses = pgTable(
  'addresses',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    zoneId: uuid()
      .notNull()
      .references(() => deliveryZones.id),
    recipient: text().notNull(),
    phone: text().notNull(),
    city: text().notNull(),
    district: text(),
    street: text().notNull(),
    house: text().notNull(),
    apartment: text(),
    /** Ориентир — в Узбекистане курьеры ориентируются по нему чаще, чем по номеру дома */
    landmark: text(),
    isDefault: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('addresses_user_idx').on(t.userId)],
);

/** Корзина авторизованного пользователя. Гостевая живёт в браузере и сливается при входе. */
export const cartItems = pgTable(
  'cart_items',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    qty: integer().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

// ── Заказы ──

export const orderStatusEnum = pgEnum('order_status', orderStatuses);
export const paymentStatusEnum = pgEnum('payment_status', paymentStatuses);
export const paymentMethodEnum = pgEnum('payment_method', ['card', 'cod']);
export const orderSourceEnum = pgEnum('order_source', ['web', 'ai', 'mcp', 'admin']);
export const orderActorEnum = pgEnum('order_actor', [
  'customer',
  'admin',
  'system',
  'webhook',
  'agent',
]);

/** Сквозная нумерация заказов: RC-2026-000123 */
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 1001 });

export interface AddressSnapshot {
  recipient: string;
  phone: string;
  city: string;
  district?: string | null;
  street: string;
  house: string;
  apartment?: string | null;
  landmark?: string | null;
}

export const orders = pgTable(
  'orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull(),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    /** Секрет ссылки на заказ для гостя (страница заказа без входа) */
    accessToken: text().notNull(),
    /** Ключ попытки оформления: двойной клик «Оформить» не создаст второй заказ */
    checkoutAttemptId: text().notNull(),
    contactName: text().notNull(),
    contactPhone: text().notNull(),
    locale: text().notNull(),
    status: orderStatusEnum().notNull(),
    paymentStatus: paymentStatusEnum().notNull().default('unpaid'),
    paymentMethod: paymentMethodEnum().notNull(),
    subtotalUzs: bigint({ mode: 'number' }).notNull(),
    discountUzs: bigint({ mode: 'number' }).notNull().default(0),
    deliveryUzs: bigint({ mode: 'number' }).notNull().default(0),
    servicesUzs: bigint({ mode: 'number' }).notNull().default(0),
    totalUzs: bigint({ mode: 'number' }).notNull(),
    /** Валюта и сумма списания у платёжного провайдера (в минимальных единицах) */
    chargeCurrency: text(),
    chargeAmountMinor: bigint({ mode: 'number' }),
    fxRate: numeric({ precision: 14, scale: 4 }),
    promoCodeId: uuid().references(() => promoCodes.id),
    zoneId: uuid()
      .notNull()
      .references(() => deliveryZones.id),
    addressSnapshot: jsonb().$type<AddressSnapshot>(),
    comment: text(),
    buildId: uuid().references(() => builds.id, { onDelete: 'set null' }),
    source: orderSourceEnum().notNull().default('web'),
    /** Срок оплаты картой: после него резерв снимается */
    paymentExpiresAt: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelReason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_number_idx').on(t.number),
    uniqueIndex('orders_checkout_attempt_idx').on(t.checkoutAttemptId),
    index('orders_user_idx').on(t.userId, t.createdAt),
    index('orders_status_idx').on(t.status, t.createdAt),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid()
      .notNull()
      .references(() => products.id),
    /** Снимок на момент заказа — цена и название не меняются вместе с каталогом */
    sku: text().notNull(),
    name: text().notNull(),
    componentType: text().notNull(),
    priceUzs: bigint({ mode: 'number' }).notNull(),
    /** Доля скидки промокода, приходящаяся на позицию (сумма по всем позициям = discountUzs) */
    discountUzs: bigint({ mode: 'number' }).notNull().default(0),
    qty: integer().notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const orderServices = pgTable('order_services', {
  id: uuid().primaryKey().defaultRandom(),
  orderId: uuid()
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  serviceId: uuid()
    .notNull()
    .references(() => services.id),
  key: text().notNull(),
  name: jsonb().$type<LocalizedText>().notNull(),
  priceUzs: bigint({ mode: 'number' }).notNull(),
});

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatusEnum(),
    toStatus: orderStatusEnum().notNull(),
    paymentStatus: paymentStatusEnum().notNull(),
    actorType: orderActorEnum().notNull(),
    actorId: text(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('order_status_history_order_idx').on(t.orderId, t.createdAt)],
);

export const promoRedemptions = pgTable(
  'promo_redemptions',
  {
    id: uuid().primaryKey().defaultRandom(),
    promoCodeId: uuid()
      .notNull()
      .references(() => promoCodes.id),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: text(),
    /** По телефону ограничиваем «на первый заказ» и для гостей */
    phone: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('promo_redemptions_order_idx').on(t.orderId),
    index('promo_redemptions_code_idx').on(t.promoCodeId, t.phone),
  ],
);

// ── Склад ──

export const inventoryReasonEnum = pgEnum('inventory_reason', [
  'reserve',
  'release',
  'commit',
  'restock',
  'adjust',
  'return',
]);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id),
    orderId: uuid().references(() => orders.id, { onDelete: 'set null' }),
    /** reserve/release меняют резерв, commit/restock/adjust/return — физический остаток */
    delta: integer().notNull(),
    reason: inventoryReasonEnum().notNull(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('inventory_movements_product_idx').on(t.productId, t.createdAt),
    index('inventory_movements_order_idx').on(t.orderId),
  ],
);

// ── Платежи ──

export const paymentProviderEnum = pgEnum('payment_provider', ['stripe', 'mock', 'cod']);
export const paymentRecordStatusEnum = pgEnum('payment_record_status', [
  'pending',
  'succeeded',
  'failed',
  'expired',
  'partially_refunded',
  'refunded',
]);

export const payments = pgTable(
  'payments',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum().notNull(),
    /** Номер попытки оплаты: новая сессия после отказа карты — attempt + 1 */
    attempt: integer().notNull().default(1),
    checkoutSessionId: text(),
    paymentIntentId: text(),
    amountMinor: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull(),
    status: paymentRecordStatusEnum().notNull().default('pending'),
    failureCode: text(),
    refundedMinor: bigint({ mode: 'number' }).notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payments_session_idx').on(t.checkoutSessionId),
    index('payments_order_idx').on(t.orderId),
    index('payments_intent_idx').on(t.paymentIntentId),
  ],
);

export const refunds = pgTable(
  'refunds',
  {
    id: uuid().primaryKey().defaultRandom(),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    providerRefundId: text(),
    amountMinor: bigint({ mode: 'number' }).notNull(),
    reason: text(),
    restock: boolean().notNull().default(false),
    status: text().notNull().default('pending'),
    createdBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('refunds_provider_idx').on(t.providerRefundId)],
);

export const webhookEventStatusEnum = pgEnum('webhook_event_status', [
  'received',
  'processed',
  'ignored',
  'failed',
]);

/** Входящие события Stripe. PK — id события (evt_…): основа идемпотентности вебхука. */
export const stripeEvents = pgTable('stripe_events', {
  id: text().primaryKey(),
  type: text().notNull(),
  payload: jsonb().notNull(),
  status: webhookEventStatusEnum().notNull().default('received'),
  error: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp({ withTimezone: true }),
});

// ── Dev-ящик: сообщения Telegram в режиме без токена бота ──

export const devOutbox = pgTable(
  'dev_outbox',
  {
    id: uuid().primaryKey().defaultRandom(),
    channel: text().notNull(),
    to: text().notNull(),
    text: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dev_outbox_time_idx').on(t.createdAt)],
);

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
