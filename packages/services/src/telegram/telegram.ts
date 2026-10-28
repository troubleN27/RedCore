import {
  deliveryZones,
  devOutbox,
  orderItems,
  orders,
  products,
  telegramLinkTokens,
  telegramLinks,
  type Database,
} from '@redcore/db';
import { formatPrice, isLocale, type Locale } from '@redcore/i18n';
import { getTranslator } from '@redcore/i18n/translator';
import { and, count, eq, gt, inArray, sql } from 'drizzle-orm';
import { Bot, type Context } from 'grammy';
import { randomBytes } from 'node:crypto';

// Telegram (этап 11): уведомления персоналу в админ-чат и покупателям по подписке на заказ.
// Без TELEGRAM_BOT_TOKEN бот работает в мок-режиме: исходящие вызовы Bot API перехватываются
// и пишутся в dev_outbox (видно на /dev/inbox) — тот же код, те же тексты, что и в проде.

export interface TelegramConfig {
  token: string | null;
  username: string;
  adminChatId: string | null;
  webhookSecret: string | null;
}

export function telegramConfig(
  env: Record<string, string | undefined> = process.env,
): TelegramConfig {
  const dev = env.NODE_ENV !== 'production';
  return {
    token: env.TELEGRAM_BOT_TOKEN || null,
    username: env.TELEGRAM_BOT_USERNAME || 'RedCoreUzBot',
    // В мок-режиме админ-чат условный — чтобы уведомления персоналу было видно в dev-ящике
    adminChatId: env.TELEGRAM_ADMIN_CHAT_ID || (env.TELEGRAM_BOT_TOKEN ? null : 'admin-chat'),
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || (dev ? 'dev-telegram-secret' : null),
  };
}

export const telegramMode = (config = telegramConfig()) => (config.token ? 'bot' : 'mock');

type T = (key: string, params?: Record<string, unknown>) => string;
const translator = (locale: Locale) => getTranslator(locale) as unknown as T;
const localeOf = (value: string | null | undefined): Locale =>
  value && isLocale(value) ? value : 'ru';

// ── Бот ──

/** Бот на процесс: в мок-режиме — с фиктивным botInfo (без getMe) и перехватом отправки в outbox. */
export function createTelegramBot(db: () => Promise<Database>, config = telegramConfig()): Bot {
  const bot = new Bot(config.token ?? '0:mock', {
    botInfo: config.token
      ? undefined
      : ({
          id: 0,
          is_bot: true,
          first_name: 'RedCore',
          username: config.username,
          can_join_groups: false,
          can_read_all_group_messages: false,
          supports_inline_queries: false,
          can_connect_to_business: false,
          has_main_web_app: false,
          has_topics_enabled: false,
          allows_users_to_create_topics: false,
        } as never),
  });

  if (!config.token) {
    bot.api.config.use(async (_prev, method, payload) => {
      const body = payload as { chat_id?: number | string; text?: string };
      if (method === 'sendMessage' && body.chat_id !== undefined && body.text) {
        await (
          await db()
        )
          .insert(devOutbox)
          .values({ channel: 'telegram', to: String(body.chat_id), text: body.text });
        console.info(`[dev-inbox] telegram → ${body.chat_id}: ${body.text.split('\n')[0]}`);
      }
      return {
        ok: true,
        result: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: { id: body.chat_id, type: 'private' },
          text: body.text,
        },
      } as never;
    });
  }

  const userLocale = (ctx: Context): Locale =>
    ctx.from?.language_code?.startsWith('uz') ? 'uz' : 'ru';

  bot.command('start', async (ctx) => {
    const payload = ctx.match.trim();
    if (!payload) {
      await ctx.reply(translator(userLocale(ctx))('telegram.bot.welcome'));
      return;
    }
    const linked = await subscribeByToken(await db(), payload, String(ctx.chat.id));
    if (!linked) {
      await ctx.reply(translator(userLocale(ctx))('telegram.bot.linkInvalid'));
      return;
    }
    const t = translator(linked.locale);
    await ctx.reply(
      t('telegram.bot.subscribed', {
        number: linked.number,
        status: t(`order.status.${linked.status}`),
      }),
    );
  });

  bot.command('status', async (ctx) => {
    const t = translator(userLocale(ctx));
    const list = await chatOrders(await db(), String(ctx.chat.id));
    if (list.length === 0) {
      await ctx.reply(t('telegram.bot.noOrders'));
      return;
    }
    await ctx.reply(
      [
        t('telegram.bot.statusList'),
        ...list.map((o) =>
          t('telegram.bot.statusLine', {
            number: o.number,
            status: translator(localeOf(o.locale))(`order.status.${o.status}`),
          }),
        ),
      ].join('\n'),
    );
  });

  bot.command('stop', async (ctx) => {
    await (await db()).delete(telegramLinks).where(eq(telegramLinks.chatId, String(ctx.chat.id)));
    await ctx.reply(translator(userLocale(ctx))('telegram.bot.stopped'));
  });

  bot.on('message', async (ctx) => {
    await ctx.reply(translator(userLocale(ctx))('telegram.bot.help'));
  });

  return bot;
}

// ── Подписка покупателя ──

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Deep-link t.me/<бот>?start=<токен> для страницы заказа. */
export async function createTelegramLink(db: Database, orderId: string, config = telegramConfig()) {
  const token = randomBytes(18).toString('base64url');
  await db
    .insert(telegramLinkTokens)
    .values({ token, orderId, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) });
  return { token, url: `https://t.me/${config.username}?start=${token}` };
}

export async function subscribeByToken(db: Database, token: string, chatId: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  const [row] = await db
    .select({
      orderId: orders.id,
      number: orders.number,
      status: orders.status,
      locale: orders.locale,
    })
    .from(telegramLinkTokens)
    .innerJoin(orders, eq(orders.id, telegramLinkTokens.orderId))
    .where(and(eq(telegramLinkTokens.token, token), gt(telegramLinkTokens.expiresAt, new Date())));
  if (!row) return null;
  const locale = localeOf(row.locale);
  await db
    .insert(telegramLinks)
    .values({ chatId, orderId: row.orderId, locale })
    .onConflictDoNothing();
  return { ...row, locale };
}

async function chatOrders(db: Database, chatId: string) {
  return db
    .select({ number: orders.number, status: orders.status, locale: telegramLinks.locale })
    .from(telegramLinks)
    .innerJoin(orders, eq(orders.id, telegramLinks.orderId))
    .where(eq(telegramLinks.chatId, chatId));
}

export async function telegramSubscriberCount(db: Database, orderId?: string) {
  const [row] = await db
    .select({ n: count() })
    .from(telegramLinks)
    .where(orderId ? eq(telegramLinks.orderId, orderId) : undefined);
  return row?.n ?? 0;
}

// ── Уведомления ──

export type TelegramOrderEvent =
  | { kind: 'created' }
  | { kind: 'paid' }
  | { kind: 'cancelled'; reason: string }
  | { kind: 'status'; status: 'assembling' | 'shipped' | 'delivered' }
  | { kind: 'refunded'; amountMinor: number; currency: string };

export interface TelegramNotifier {
  send(chatId: string, text: string): Promise<void>;
}

export function botNotifier(bot: Bot): TelegramNotifier {
  return {
    async send(chatId, text) {
      await bot.api.sendMessage(chatId, text, { link_preview_options: { is_disabled: true } });
    },
  };
}

const LOW_STOCK_THRESHOLD = 3;

/**
 * Событие заказа в Telegram: покупателям-подписчикам — на языке заказа, персоналу — в админ-чат
 * (новый заказ, оплата, отмена, возврат; после списания товара — «заканчивается»).
 */
export async function notifyTelegramOrder(
  db: Database,
  notifier: TelegramNotifier,
  orderId: string,
  event: TelegramOrderEvent,
  options: { siteUrl: string; consoleUrl?: string | null; config?: TelegramConfig },
): Promise<void> {
  const config = options.config ?? telegramConfig();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return;
  // Возврат — в валюте списания: сумы или доллары (режим PAYMENT_CHARGE_CURRENCY=usd)
  const money = (minor: number, currency: string, loc: Locale) =>
    currency === 'uzs'
      ? formatPrice(Math.round(minor / 100), loc)
      : `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;

  const customerKey = event.kind === 'status' ? event.status : event.kind;
  const links = await db.select().from(telegramLinks).where(eq(telegramLinks.orderId, orderId));
  for (const link of links) {
    const t = translator(localeOf(link.locale));
    const url = `${options.siteUrl}/${link.locale}/orders/${order.number}?token=${order.accessToken}`;
    const text = [
      t(`telegram.customer.${customerKey}`, {
        number: order.number,
        total: formatPrice(order.totalUzs, localeOf(link.locale)),
        amount:
          event.kind === 'refunded'
            ? money(event.amountMinor, event.currency, localeOf(link.locale))
            : '',
      }),
      t('telegram.customer.open', { url }),
    ].join('\n');
    await notifier.send(link.chatId, text);
  }

  if (!config.adminChatId || event.kind === 'status') {
    if (event.kind === 'status' && event.status === 'assembling')
      await notifyLowStock(db, notifier, orderId, config);
    return;
  }
  const t = translator('ru');
  const consoleLine = options.consoleUrl
    ? `\n${t('telegram.admin.open', { url: `${options.consoleUrl}/orders/${order.number}` })}`
    : '';
  let text: string;
  if (event.kind === 'created') {
    const [items] = await db
      .select({ n: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int` })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    const [zone] = await db
      .select({ name: deliveryZones.name })
      .from(deliveryZones)
      .where(eq(deliveryZones.id, order.zoneId));
    text = t('telegram.admin.created', {
      number: order.number,
      total: formatPrice(order.totalUzs, 'ru'),
      items: items?.n ?? 0,
      method: t(`telegram.methods.${order.paymentMethod}`),
      zone: zone?.name.ru ?? '',
      source: order.source,
    });
  } else if (event.kind === 'paid') {
    text = t('telegram.admin.paid', {
      number: order.number,
      total: formatPrice(order.totalUzs, 'ru'),
    });
  } else if (event.kind === 'cancelled') {
    text = t('telegram.admin.cancelled', { number: order.number, reason: event.reason });
  } else {
    text = t('telegram.admin.refunded', {
      number: order.number,
      amount: money(event.amountMinor, event.currency, 'ru'),
    });
  }
  await notifier.send(config.adminChatId, text + consoleLine);
  if (event.kind === 'paid') await notifyLowStock(db, notifier, orderId, config);
}

/** «Заканчивается»: товары заказа, у которых после списания осталось ≤ 3 доступных. */
async function notifyLowStock(
  db: Database,
  notifier: TelegramNotifier,
  orderId: string,
  config: TelegramConfig,
) {
  if (!config.adminChatId) return;
  const ids = (
    await db
      .select({ id: orderItems.productId })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
  )
    .map((r) => r.id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;
  const low = await db
    .select({
      name: products.name,
      sku: products.sku,
      available: sql<number>`(${products.stockQty} - ${products.reservedQty})::int`,
    })
    .from(products)
    .where(
      and(
        inArray(products.id, ids),
        sql`${products.stockQty} - ${products.reservedQty} <= ${LOW_STOCK_THRESHOLD}`,
      ),
    );
  if (low.length === 0) return;
  await notifier.send(
    config.adminChatId,
    translator('ru')('telegram.admin.lowStock', {
      items: low.map((p) => `${p.name} (${p.sku}) — ${p.available}`).join('; '),
    }),
  );
}

export async function sendTelegramTest(notifier: TelegramNotifier, config = telegramConfig()) {
  if (!config.adminChatId) return false;
  await notifier.send(config.adminChatId, translator('ru')('telegram.admin.test'));
  return true;
}
