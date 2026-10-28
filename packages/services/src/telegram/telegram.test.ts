import { devOutbox, orders, products, telegramLinks, type Database } from '@redcore/db';
import { createTestDatabase, type TestDatabase } from '@redcore/db/testing';
import { desc, eq, sql } from 'drizzle-orm';
import type { Bot } from 'grammy';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCatalogSnapshot } from '../catalog/snapshot';
import { placeOrder } from '../orders/checkout';
import {
  botNotifier,
  createTelegramBot,
  createTelegramLink,
  notifyTelegramOrder,
  sendTelegramTest,
  subscribeByToken,
  telegramConfig,
  telegramMode,
  telegramSubscriberCount,
  type TelegramConfig,
} from './telegram';

let testDb: TestDatabase;
let db: Database;
let bot: Bot;
let orderId: string;
let orderNumber: string;
const config: TelegramConfig = telegramConfig({ NODE_ENV: 'test' });

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  bot = createTelegramBot(async () => db, config);
  const snapshot = await getCatalogSnapshot(db, 'uz');
  const product = snapshot.products.find((p) => p.componentType === 'storage')!;
  const placed = await placeOrder(
    db,
    snapshot,
    {
      checkoutAttemptId: randomUUID(),
      items: [{ slug: product.slug, qty: 1 }],
      contact: { name: 'Telegram Test', phone: '+998901110000' },
      zoneCode: 'pickup',
      paymentMethod: 'cod',
    },
    { locale: 'uz', cardEnabled: true },
  );
  orderId = placed.orderId;
  orderNumber = placed.number;
});

afterAll(async () => {
  await testDb.close();
});

let updateId = 1;
/** Апдейт Telegram «пользователь написал текст» — как его присылает вебхук. */
async function userSays(chatId: number, text: string, language = 'ru') {
  await bot.handleUpdate({
    update_id: updateId++,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: 'private', first_name: 'Test' },
      from: { id: chatId, is_bot: false, first_name: 'Test', language_code: language },
      text,
      ...(text.startsWith('/')
        ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0]!.length }] }
        : {}),
    },
  } as never);
}

async function lastTo(to: string) {
  const [row] = await db
    .select()
    .from(devOutbox)
    .where(sql`${devOutbox.channel} = 'telegram' and ${devOutbox.to} = ${to}`)
    .orderBy(desc(devOutbox.createdAt))
    .limit(1);
  return row?.text ?? '';
}

describe('Telegram-бот (мок-режим)', () => {
  it('без токена — мок: условный админ-чат и dev-секрет вебхука; в проде секрета по умолчанию нет', () => {
    expect(telegramMode(config)).toBe('mock');
    expect(config).toMatchObject({
      adminChatId: 'admin-chat',
      webhookSecret: 'dev-telegram-secret',
    });
    expect(telegramConfig({ NODE_ENV: 'production' }).webhookSecret).toBeNull();
    const real = telegramConfig({ TELEGRAM_BOT_TOKEN: '1:x', TELEGRAM_BOT_USERNAME: 'shop_bot' });
    expect(real).toMatchObject({ token: '1:x', username: 'shop_bot', adminChatId: null });
  });

  it('deep-link: /start с токеном подписывает чат и отвечает на языке заказа', async () => {
    const link = await createTelegramLink(db, orderId, config);
    expect(link.url).toBe(`https://t.me/RedCoreUzBot?start=${link.token}`);
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    await userSays(5001, `/start ${link.token}`);
    expect(await lastTo('5001')).toContain(`${orderNumber} buyurtmasi haqida xabar beraman`);
    expect(await telegramSubscriberCount(db, orderId)).toBe(1);
    // Повторное открытие той же ссылки не дублирует подписку
    await userSays(5001, `/start ${link.token}`);
    expect(await telegramSubscriberCount(db, orderId)).toBe(1);
  });

  it('неверная или просроченная ссылка, /start без параметра и прочий текст', async () => {
    await userSays(5002, '/start nope-nope-nope');
    expect(await lastTo('5002')).toContain('Ссылка устарела');
    expect(await subscribeByToken(db, 'bad token!', '5002')).toBeNull();
    await userSays(5002, '/start', 'uz');
    expect(await lastTo('5002')).toContain('RedCore doʻkoni boti');
    await userSays(5002, 'привет');
    expect(await lastTo('5002')).toContain('/status');
  });

  it('статусы приходят подписчику на языке заказа, персоналу — в админ-чат', async () => {
    const notifier = botNotifier(bot);
    const options = {
      siteUrl: 'https://redcore.test',
      consoleUrl: 'https://redcore.test/ops',
      config,
    };
    await notifyTelegramOrder(db, notifier, orderId, { kind: 'created' }, options);
    expect(await lastTo('admin-chat')).toContain(`Новый заказ ${orderNumber}`);
    expect(await lastTo('admin-chat')).toContain(`https://redcore.test/ops/orders/${orderNumber}`);
    expect(await lastTo('5001')).toContain('qabul qilindi');

    await notifyTelegramOrder(
      db,
      notifier,
      orderId,
      { kind: 'status', status: 'shipped' },
      options,
    );
    const shipped = await lastTo('5001');
    expect(shipped).toContain(`${orderNumber} buyurtmasi yetkazib berishga topshirildi`);
    expect(shipped).toContain(`https://redcore.test/uz/orders/${orderNumber}?token=`);

    await notifyTelegramOrder(
      db,
      notifier,
      orderId,
      { kind: 'refunded', amountMinor: 50_000_000, currency: 'uzs' },
      options,
    );
    expect(await lastTo('5001')).toMatch(/500\s000\sso.m/u);
    expect(await lastTo('admin-chat')).toContain(`Возврат по заказу ${orderNumber}`);
    await notifyTelegramOrder(
      db,
      notifier,
      orderId,
      { kind: 'refunded', amountMinor: 1250, currency: 'usd' },
      options,
    );
    expect(await lastTo('admin-chat')).toContain('12.50 USD');
  });

  it('после оплаты — «заканчивается» по товарам заказа с малым остатком', async () => {
    const [item] = await db
      .execute(sql`select product_id from order_items where order_id = ${orderId}`)
      .then((r) => (r as unknown as { rows: { product_id: string }[] }).rows);
    await db
      .update(products)
      .set({ stockQty: 2, reservedQty: 0 })
      .where(eq(products.id, item!.product_id));
    await notifyTelegramOrder(
      db,
      botNotifier(bot),
      orderId,
      { kind: 'paid' },
      { siteUrl: 'https://redcore.test', config },
    );
    expect(await lastTo('admin-chat')).toContain('Заканчивается');
  });

  it('/status показывает заказы чата, /stop отписывает', async () => {
    await db.update(orders).set({ status: 'assembling' }).where(eq(orders.id, orderId));
    await userSays(5001, '/status');
    expect(await lastTo('5001')).toContain(
      `${orderNumber} — Yigʻilmoqda`.slice(0, orderNumber.length + 3),
    );
    await userSays(5001, '/stop');
    expect(await lastTo('5001')).toContain('Уведомления отключены');
    expect(await db.select().from(telegramLinks).where(eq(telegramLinks.chatId, '5001'))).toEqual(
      [],
    );
    await userSays(5001, '/status');
    expect(await lastTo('5001')).toContain('не подписаны');
  });

  it('тестовое сообщение из консоли; без админ-чата — не отправляется', async () => {
    expect(await sendTelegramTest(botNotifier(bot), config)).toBe(true);
    expect(await lastTo('admin-chat')).toContain('Тестовое сообщение');
    expect(await sendTelegramTest(botNotifier(bot), { ...config, adminChatId: null })).toBe(false);
  });
});
