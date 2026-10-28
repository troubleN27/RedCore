import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { LocalizedText } from './catalog';

// Справочники оформления заказа. Сами заказы, оплаты и корзины — этап 4.

export const deliveryZones = pgTable(
  'delivery_zones',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    name: jsonb().$type<LocalizedText>().notNull(),
    priceUzs: bigint({ mode: 'number' }).notNull(),
    /** Бесплатная доставка от этой суммы заказа */
    freeFromUzs: bigint({ mode: 'number' }),
    etaMinDays: integer().notNull(),
    etaMaxDays: integer().notNull(),
    codAllowed: boolean().notNull().default(true),
    isPickup: boolean().notNull().default(false),
    sort: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
  },
  (t) => [uniqueIndex('delivery_zones_code_idx').on(t.code)],
);

export const services = pgTable(
  'services',
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull(),
    name: jsonb().$type<LocalizedText>().notNull(),
    description: jsonb().$type<LocalizedText>().notNull(),
    priceUzs: bigint({ mode: 'number' }).notNull(),
    isActive: boolean().notNull().default(true),
  },
  (t) => [uniqueIndex('services_key_idx').on(t.key)],
);

export const promoTypeEnum = pgEnum('promo_type', ['percent', 'fixed']);

export const promoCodes = pgTable(
  'promo_codes',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Хранится в верхнем регистре; ввод клиента нормализуется */
    code: text().notNull(),
    type: promoTypeEnum().notNull(),
    /** Процент (1–100) или сумма в сумах */
    value: bigint({ mode: 'number' }).notNull(),
    minOrderUzs: bigint({ mode: 'number' }),
    maxDiscountUzs: bigint({ mode: 'number' }),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    usageLimit: integer(),
    perUserLimit: integer(),
    usedCount: integer().notNull().default(0),
    /** Ограничение по типам товаров; пусто — на весь заказ */
    appliesTo: jsonb().$type<{ componentTypes?: string[] }>(),
    description: jsonb().$type<LocalizedText>(),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('promo_codes_code_idx').on(t.code)],
);

export type DeliveryZoneRow = typeof deliveryZones.$inferSelect;
export type PromoCodeRow = typeof promoCodes.$inferSelect;
