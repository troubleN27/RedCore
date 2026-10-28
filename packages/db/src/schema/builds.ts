import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { pcComponentTypes } from '@redcore/domain';
import { products } from './catalog';

export const buildSourceEnum = pgEnum('build_source', ['manual', 'ai', 'reverse_fps', 'prebuilt']);
export const buildStatusEnum = pgEnum('build_status', ['incomplete', 'errors', 'warnings', 'ok']);
export const buildSlotEnum = pgEnum('build_slot', pcComponentTypes);

/** Сохранённая сборка: открывается по короткой ссылке /b/<publicId>. */
export const builds = pgTable(
  'builds',
  {
    id: uuid().primaryKey().defaultRandom(),
    publicId: text().notNull(),
    /** Владелец появится с авторизацией (этап 4); до этого сборки анонимные */
    userId: text(),
    name: text(),
    source: buildSourceEnum().notNull().default('manual'),
    /** Цвет RGB-подсветки в 3D (этап 7) */
    rgbColor: text(),
    /** Снимки на момент сохранения — для списков и аналитики без пересчёта */
    totalUzs: bigint({ mode: 'number' }).notNull(),
    powerW: integer().notNull(),
    compatStatus: buildStatusEnum().notNull(),
    /** Хэш состава: одинаковые сборки считаются вместе в «популярных сборках» */
    signature: text().notNull(),
    viewCount: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('builds_public_id_idx').on(t.publicId),
    index('builds_signature_idx').on(t.signature),
  ],
);

export const buildItems = pgTable(
  'build_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    buildId: uuid()
      .notNull()
      .references(() => builds.id, { onDelete: 'cascade' }),
    slot: buildSlotEnum().notNull(),
    productId: uuid()
      .notNull()
      .references(() => products.id),
    qty: integer().notNull().default(1),
    position: integer().notNull().default(0),
  },
  (t) => [index('build_items_build_idx').on(t.buildId)],
);

/** События воронки (конфигуратор → корзина → заказ) для дашборда админки. */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    type: text().notNull(),
    sessionId: text(),
    buildId: uuid().references(() => builds.id, { onDelete: 'set null' }),
    payload: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('analytics_events_type_time_idx').on(t.type, t.createdAt)],
);

export type BuildRow = typeof builds.$inferSelect;
