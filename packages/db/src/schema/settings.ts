import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Настройки магазина «ключ → JSON»: контакты, курс USD/UZS, цена сборки,
 * лимиты AI, эталоны FPS. Редактируются из админки (этап 5).
 */
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type SettingRow = typeof settings.$inferSelect;
