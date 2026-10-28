import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { orders } from './orders';
import { products } from './catalog';

/** Журнал действий персонала: кто, что и над чем сделал, с diff изменений. */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: text().references(() => user.id, { onDelete: 'set null' }),
    actorLogin: text(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    diff: jsonb().$type<Record<string, unknown>>(),
    ip: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('admin_audit_time_idx').on(t.createdAt),
    index('admin_audit_entity_idx').on(t.entity, t.entityId),
  ],
);

/** Неудачные попытки входа (консоль и покупатели): после 5 подряд — блокировка на 15 минут. */
export const adminLoginAttempts = pgTable('admin_login_attempts', {
  /** Логин в нижнем регистре; у покупателя — номер цифрами */
  key: text().primaryKey(),
  failures: integer().notNull().default(0),
  lockedUntil: timestamp({ withTimezone: true }),
  lastAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const reviewStatusEnum = pgEnum('review_status', ['pending', 'approved', 'rejected']);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    authorName: text().notNull(),
    rating: smallint().notNull(),
    text: text().notNull(),
    pros: text(),
    cons: text(),
    locale: text().notNull().default('ru'),
    status: reviewStatusEnum().notNull().default('pending'),
    /** Покупатель получил этот товар в оплаченном/доставленном заказе */
    verifiedPurchase: integer().notNull().default(0),
    orderId: uuid().references(() => orders.id, { onDelete: 'set null' }),
    moderatedBy: text(),
    moderatedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('reviews_product_idx').on(t.productId, t.status),
    index('reviews_status_idx').on(t.status, t.createdAt),
  ],
);

export type ReviewRow = typeof reviews.$inferSelect;
export type AuditRow = typeof adminAuditLog.$inferSelect;
