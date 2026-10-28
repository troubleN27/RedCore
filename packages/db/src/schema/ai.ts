import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { products } from './catalog';
import { orders } from './orders';

// MCP и AI (план, §5 и §9): ключи внешних MCP-клиентов и журнал вызовов инструментов.
// Ключ хранится только как SHA-256-хэш; в консоли видны префикс и scopes.

export const apiKeys = pgTable('api_keys', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  /** Первые символы ключа (rc_xxxxxxxx) — чтобы узнать ключ в списке, не храня его */
  prefix: text().notNull(),
  keyHash: text().notNull().unique(),
  scopes: text().array().notNull().default([]),
  /** Пользователь, от имени которого действуют scopes «:own» (null — ключ магазина) */
  userId: text().references(() => user.id, { onDelete: 'cascade' }),
  createdBy: text().references(() => user.id, { onDelete: 'set null' }),
  lastUsedAt: timestamp({ withTimezone: true }),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const toolCallSourceEnum = pgEnum('tool_call_source', ['agent', 'mcp_external']);

export const aiToolCalls = pgTable(
  'ai_tool_calls',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Запуск агента; у внешних MCP-клиентов — null */
    runId: uuid(),
    apiKeyId: uuid().references(() => apiKeys.id, { onDelete: 'set null' }),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    source: toolCallSourceEnum().notNull(),
    /** Транспорт: in-memory, http, stdio */
    transport: text().notNull(),
    tool: text().notNull(),
    /** Аргументы с замаскированными телефонами и почтой */
    args: jsonb().notNull(),
    resultPreview: text(),
    ok: boolean().notNull(),
    error: text(),
    durationMs: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_tool_calls_created_idx').on(t.createdAt),
    index('ai_tool_calls_key_idx').on(t.apiKeyId),
  ],
);

// ── Агенты (этап 10) ──

export const aiAgentEnum = pgEnum('ai_agent', ['consultant', 'reviewer', 'support', 'admin']);

/** Диалог: пользователь или гость (по токену из cookie), место на сайте, язык. */
export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    guestToken: text(),
    agent: aiAgentEnum().notNull(),
    place: text().notNull(),
    locale: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_conversations_user_idx').on(t.userId),
    index('ai_conversations_guest_idx').on(t.guestToken),
  ],
);

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: text({ enum: ['user', 'assistant'] }).notNull(),
    agent: aiAgentEnum(),
    content: text().notNull(),
    /** Карточки UI (сборка, замена, товары, график) — рендерятся по данным из БД */
    ui: jsonb().$type<unknown[]>().notNull().default([]),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_messages_conversation_idx').on(t.conversationId, t.createdAt)],
);

/** Один запуск агента: модель, фолбэк, токены, латентность, оценка стоимости, ошибка. */
export const aiRuns = pgTable(
  'ai_runs',
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid().references(() => aiConversations.id, { onDelete: 'set null' }),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    guestToken: text(),
    agent: aiAgentEnum().notNull(),
    /** Модель, ответившая последней; null — детерминированный режим без LLM */
    model: text(),
    /** Модель, с которой начали, если пришлось перейти по цепочке фолбэков */
    fallbackFrom: text(),
    /** Режим без AI: no_key | disabled | breaker | failed | budget */
    deterministic: text(),
    steps: integer().notNull().default(0),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    thoughtTokens: integer().notNull().default(0),
    cachedTokens: integer().notNull().default(0),
    latencyMs: integer().notNull().default(0),
    costUsdMicros: integer().notNull().default(0),
    /** Ответ переписан из-за суммы, которой нет в результатах инструментов */
    guardRetried: boolean().notNull().default(false),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_runs_created_idx').on(t.createdAt), index('ai_runs_user_idx').on(t.userId)],
);

/** Черновики от агентов: запись в каталог — только после подтверждения сотрудником. */
export const aiDrafts = pgTable('ai_drafts', {
  id: uuid().primaryKey().defaultRandom(),
  kind: text({ enum: ['product_copy'] }).notNull(),
  productId: uuid().references(() => products.id, { onDelete: 'cascade' }),
  payload: jsonb().notNull(),
  status: text({ enum: ['pending', 'applied', 'rejected'] })
    .notNull()
    .default('pending'),
  createdBy: text().references(() => user.id, { onDelete: 'set null' }),
  reviewedBy: text().references(() => user.id, { onDelete: 'set null' }),
  reviewedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Обращения из чата поддержки (handoff на человека). */
export const supportTickets = pgTable('support_tickets', {
  id: uuid().primaryKey().defaultRandom(),
  number: text().notNull().unique(),
  userId: text().references(() => user.id, { onDelete: 'set null' }),
  orderId: uuid().references(() => orders.id, { onDelete: 'set null' }),
  contactName: text(),
  contactPhone: text(),
  topic: text().notNull(),
  message: text().notNull(),
  status: text({ enum: ['open', 'closed'] })
    .notNull()
    .default('open'),
  locale: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type AiRunRow = typeof aiRuns.$inferSelect;
export type AiToolCallRow = typeof aiToolCalls.$inferSelect;
