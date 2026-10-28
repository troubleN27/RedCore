import {
  aiConversations,
  aiDrafts,
  aiMessages,
  aiRuns,
  orderItems,
  orders,
  productTranslations,
  products,
  settings,
  supportTickets,
  type Database,
} from '@redcore/db';
import { normalizeUzPhone } from '@redcore/domain';
import { and, asc, count, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AdminValidationError } from '../admin/catalog';
import { invalidateCatalogCache } from '../catalog/snapshot';

// Данные AI-агентов (план, §8): настройки и лимиты, диалоги, запуски с токенами,
// черновики описаний, обращения в поддержку и детерминированные отчёты для админ-агента.

export type AgentName = 'consultant' | 'reviewer' | 'support' | 'admin';

// ── Настройки ──

export const aiSettingsSchema = z.object({
  enabled: z.boolean(),
  guestPer10Min: z.number().int().min(1).max(1000),
  userPer10Min: z.number().int().min(1).max(1000),
  dailyTokensGuest: z.number().int().min(1000),
  dailyTokensUser: z.number().int().min(1000),
  maxMessageChars: z.number().int().min(100).max(10_000),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  guestPer10Min: 20,
  userPer10Min: 60,
  dailyTokensGuest: 60_000,
  dailyTokensUser: 250_000,
  maxMessageChars: 2000,
};

export async function getAiSettings(db: Database): Promise<AiSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'ai'));
  const parsed = aiSettingsSchema.safeParse({ ...DEFAULT_AI_SETTINGS, ...(row?.value as object) });
  return parsed.success ? parsed.data : DEFAULT_AI_SETTINGS;
}

export async function updateAiSettings(db: Database, input: AiSettings) {
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success)
    throw new AdminValidationError(parsed.error.issues.map((i) => i.path.join('.')));
  await db
    .insert(settings)
    .values({ key: 'ai', value: parsed.data })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: parsed.data, updatedAt: sql`now()` },
    });
}

/** Токены за последние сутки — для дневного бюджета пользователя или гостя. */
export async function tokensUsedToday(
  db: Database,
  who: { userId?: string | null; guestToken?: string | null },
) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const owner = who.userId
    ? eq(aiRuns.userId, who.userId)
    : eq(aiRuns.guestToken, who.guestToken ?? '');
  const [row] = await db
    .select({
      n: sql<number>`coalesce(sum(${aiRuns.inputTokens} + ${aiRuns.outputTokens} + ${aiRuns.thoughtTokens}), 0)::int`,
    })
    .from(aiRuns)
    .where(and(owner, gte(aiRuns.createdAt, since)));
  return row?.n ?? 0;
}

// ── Диалоги и запуски ──

export async function getOrCreateConversation(
  db: Database,
  input: {
    id?: string | null;
    userId: string | null;
    guestToken: string | null;
    agent: AgentName;
    place: string;
    locale: string;
  },
) {
  if (input.id) {
    const [row] = await db.select().from(aiConversations).where(eq(aiConversations.id, input.id));
    // Чужой диалог не продолжаем — начинаем новый
    const own =
      row && (input.userId ? row.userId === input.userId : row.guestToken === input.guestToken);
    if (row && own) return row;
  }
  const [row] = await db
    .insert(aiConversations)
    .values({
      userId: input.userId,
      guestToken: input.userId ? null : input.guestToken,
      agent: input.agent,
      place: input.place,
      locale: input.locale,
    })
    .returning();
  return row!;
}

export async function setConversationAgent(db: Database, id: string, agent: AgentName) {
  await db
    .update(aiConversations)
    .set({ agent, updatedAt: sql`now()` })
    .where(eq(aiConversations.id, id));
}

/** Последние сообщения диалога — история для модели (без вызовов инструментов). */
export async function conversationHistory(db: Database, conversationId: string, limit = 16) {
  const rows = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function addMessage(
  db: Database,
  message: {
    conversationId: string;
    role: 'user' | 'assistant';
    agent?: AgentName;
    content: string;
    ui?: unknown[];
  },
) {
  await db.insert(aiMessages).values({
    conversationId: message.conversationId,
    role: message.role,
    agent: message.agent ?? null,
    content: message.content,
    ui: message.ui ?? [],
  });
  await db
    .update(aiConversations)
    .set({ updatedAt: sql`now()` })
    .where(eq(aiConversations.id, message.conversationId));
}

export type AiRunInput = typeof aiRuns.$inferInsert;

export async function recordRun(db: Database, run: AiRunInput) {
  const [row] = await db.insert(aiRuns).values(run).returning({ id: aiRuns.id });
  return row!.id;
}

export async function updateRun(db: Database, id: string, patch: Partial<AiRunInput>) {
  await db.update(aiRuns).set(patch).where(eq(aiRuns.id, id));
}

export const AI_LOG_PAGE = 50;

/** Страница «AI-логи»: запуски с фильтрами и сводка по дням для графиков. */
export async function listAiRuns(
  db: Database,
  filter: { agent?: AgentName; errorsOnly?: boolean; page?: number } = {},
) {
  const page = Math.max(1, filter.page ?? 1);
  const conditions = [
    filter.agent ? eq(aiRuns.agent, filter.agent) : undefined,
    filter.errorsOnly
      ? or(sql`${aiRuns.error} is not null`, sql`${aiRuns.deterministic} is not null`)
      : undefined,
  ].filter(Boolean);
  const where = conditions.length ? and(...conditions) : undefined;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const day = sql<string>`to_char(date_trunc('day', ${aiRuns.createdAt}), 'YYYY-MM-DD')`;
  const [rows, [total], daily] = await Promise.all([
    db
      .select()
      .from(aiRuns)
      .where(where)
      .orderBy(desc(aiRuns.createdAt))
      .limit(AI_LOG_PAGE)
      .offset((page - 1) * AI_LOG_PAGE),
    db.select({ n: count() }).from(aiRuns).where(where),
    db
      .select({
        day,
        runs: count(),
        tokens: sql<number>`coalesce(sum(${aiRuns.inputTokens} + ${aiRuns.outputTokens} + ${aiRuns.thoughtTokens}), 0)::int`,
        errors: sql<number>`count(*) filter (where ${aiRuns.error} is not null)::int`,
        fallbacks: sql<number>`count(*) filter (where ${aiRuns.fallbackFrom} is not null or ${aiRuns.deterministic} is not null)::int`,
        costMicros: sql<number>`coalesce(sum(${aiRuns.costUsdMicros}), 0)::int`,
      })
      .from(aiRuns)
      .where(gte(aiRuns.createdAt, since))
      .groupBy(day)
      .orderBy(day),
  ]);
  return { rows, total: total?.n ?? 0, page, daily };
}

export async function getConversationMessages(db: Database, conversationId: string) {
  return db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt));
}

// ── Поддержка ──

export async function createSupportTicket(
  db: Database,
  input: {
    userId: string | null;
    orderNumber?: string;
    contactName?: string;
    contactPhone?: string;
    topic: string;
    message: string;
    locale: string;
  },
) {
  let orderId: string | null = null;
  if (input.orderNumber) {
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.number, input.orderNumber));
    orderId = order?.id ?? null;
  }
  const number = `SUP-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const [row] = await db
    .insert(supportTickets)
    .values({
      number,
      userId: input.userId,
      orderId,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone
        ? (normalizeUzPhone(input.contactPhone) ?? input.contactPhone)
        : null,
      topic: input.topic,
      message: input.message,
      locale: input.locale,
    })
    .returning({ number: supportTickets.number });
  return row!;
}

// ── Черновики описаний ──

export const productCopySchema = z.object({
  ru: z.object({ short: z.string().min(10).max(300), description: z.string().min(40).max(4000) }),
  uz: z.object({ short: z.string().min(10).max(300), description: z.string().min(40).max(4000) }),
});
export type ProductCopy = z.infer<typeof productCopySchema>;

export async function createProductCopyDraft(
  db: Database,
  productId: string,
  copy: ProductCopy,
  createdBy: string | null,
) {
  const parsed = productCopySchema.parse(copy);
  const [row] = await db
    .insert(aiDrafts)
    .values({ kind: 'product_copy', productId, payload: parsed, createdBy })
    .returning({ id: aiDrafts.id });
  return row!;
}

export async function listPendingDrafts(db: Database) {
  return db
    .select({
      id: aiDrafts.id,
      productId: aiDrafts.productId,
      productName: products.name,
      sku: products.sku,
      payload: aiDrafts.payload,
      createdAt: aiDrafts.createdAt,
    })
    .from(aiDrafts)
    .leftJoin(products, eq(products.id, aiDrafts.productId))
    .where(eq(aiDrafts.status, 'pending'))
    .orderBy(desc(aiDrafts.createdAt));
}

/** Применить черновик: тексты в переводы товара с пометкой source=ai (видно, что не ручные). */
export async function reviewDraft(
  db: Database,
  id: string,
  decision: 'applied' | 'rejected',
  staffId: string,
) {
  await db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(aiDrafts)
      .where(and(eq(aiDrafts.id, id), eq(aiDrafts.status, 'pending')))
      .for('update');
    if (!draft) throw new AdminValidationError(['id']);
    if (decision === 'applied' && draft.productId) {
      const copy = productCopySchema.parse(draft.payload);
      for (const locale of ['ru', 'uz'] as const) {
        await tx
          .insert(productTranslations)
          .values({
            productId: draft.productId,
            locale,
            shortDescription: copy[locale].short,
            description: copy[locale].description,
            source: 'ai',
            reviewedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [productTranslations.productId, productTranslations.locale],
            set: {
              shortDescription: copy[locale].short,
              description: copy[locale].description,
              source: 'ai',
              reviewedAt: new Date(),
            },
          });
      }
    }
    await tx
      .update(aiDrafts)
      .set({ status: decision, reviewedBy: staffId, reviewedAt: new Date() })
      .where(eq(aiDrafts.id, id));
  });
  if (decision === 'applied') invalidateCatalogCache();
}

// ── Закупка ──

export interface PurchaseRecommendation {
  productId: string;
  sku: string;
  name: string;
  available: number;
  sold30: number;
  sold90: number;
  /** Продаж в день (взвешенно: 30 дней важнее 90) */
  dailyVelocity: number;
  reorderPoint: number;
  recommendedQty: number;
  daysOfStock: number | null;
}

/**
 * Рекомендации по закупке (детерминированно, LLM только объясняет): скорость продаж за 30 и
 * 90 дней, срок поставки и страховой запас → точка заказа и количество на 30 дней вперёд.
 */
export async function purchaseRecommendations(
  db: Database,
  options: { leadTimeDays?: number; coverDays?: number; limit?: number; now?: Date } = {},
): Promise<PurchaseRecommendation[]> {
  const lead = options.leadTimeDays ?? 7;
  const cover = options.coverDays ?? 30;
  const now = options.now ?? new Date();
  const since90 = new Date(now.getTime() - 90 * 86_400_000);
  const since30 = new Date(now.getTime() - 30 * 86_400_000);
  const sold = await db
    .select({
      productId: orderItems.productId,
      sold30: sql<number>`coalesce(sum(${orderItems.qty}) filter (where ${orders.createdAt} >= ${since30}), 0)::int`,
      sold90: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        gte(orders.createdAt, since90),
        inArray(orders.status, [
          'paid',
          'assembling',
          'shipped',
          'delivered',
          'created',
          'pending_payment',
        ]),
      ),
    )
    .groupBy(orderItems.productId);
  if (sold.length === 0) return [];
  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      available: sql<number>`(${products.stockQty} - ${products.reservedQty})::int`,
    })
    .from(products)
    .where(
      inArray(
        products.id,
        sold.map((s) => s.productId).filter((id): id is string => Boolean(id)),
      ),
    );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const result: PurchaseRecommendation[] = [];
  for (const s of sold) {
    const p = s.productId ? byId.get(s.productId) : undefined;
    if (!p) continue;
    const velocity = 0.7 * (s.sold30 / 30) + 0.3 * (s.sold90 / 90);
    const safety = Math.ceil(velocity * lead * 0.5);
    const reorderPoint = Math.ceil(velocity * lead) + safety;
    const recommendedQty = Math.max(0, Math.ceil(velocity * (lead + cover)) + safety - p.available);
    result.push({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      available: p.available,
      sold30: s.sold30,
      sold90: s.sold90,
      dailyVelocity: Math.round(velocity * 100) / 100,
      reorderPoint,
      recommendedQty,
      daysOfStock: velocity > 0 ? Math.floor(p.available / velocity) : null,
    });
  }
  return result
    .filter((r) => r.available <= r.reorderPoint || r.recommendedQty > 0)
    .sort((a, b) => (a.daysOfStock ?? Infinity) - (b.daysOfStock ?? Infinity))
    .slice(0, options.limit ?? 20);
}
