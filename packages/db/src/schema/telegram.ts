import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { orders } from './orders';

// Telegram (план, §5 и этап 11): покупатель подписывается на статусы заказа по deep-link
// со страницы заказа. Токен ссылки одноразовый по смыслу и живёт 7 дней.

export const telegramLinkTokens = pgTable('telegram_link_tokens', {
  token: text().primaryKey(),
  orderId: uuid()
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const telegramLinks = pgTable(
  'telegram_links',
  {
    id: uuid().primaryKey().defaultRandom(),
    chatId: text().notNull(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /** Язык уведомлений — язык заказа */
    locale: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('telegram_links_chat_order').on(t.chatId, t.orderId),
    index('telegram_links_order_idx').on(t.orderId),
  ],
);

export type TelegramLinkRow = typeof telegramLinks.$inferSelect;
