import { inventoryMovements, payments, products, type Database } from '@redcore/db';
import { createTestDatabase, type TestDatabase } from '@redcore/db/testing';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getCatalogSnapshot, invalidateCatalogCache } from '../catalog/snapshot';
import type { CatalogSnapshot, ProductSummary } from '../catalog/types';
import {
  mergeCartLines,
  mergeUserCart,
  getUserCart,
  saveAddress,
  listAddresses,
} from '../account/account';
import { CheckoutError, placeOrder, quoteCart, type PlaceOrderInput } from './checkout';
import { buildMockEvent, createMockGateway, signTestEvent, type PaymentGateway } from './gateway';
import {
  cancelOrderByCustomer,
  expireStaleOrders,
  handleStripeEvent,
  startPayment,
} from './payments';
import { canViewOrder, getOrderByNumber } from './queries';

let testDb: TestDatabase;
let db: Database;
let ru: CatalogSnapshot;
let gateway: PaymentGateway;
let cpu: ProductSummary;
let board: ProductSummary;

const SITE = 'http://localhost:3000';
const payOptions = { siteUrl: SITE, chargeCurrency: 'uzs' as const };

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  gateway = createMockGateway(db);
});

beforeEach(async () => {
  invalidateCatalogCache();
  ru = await getCatalogSnapshot(db, 'ru');
  // Дороже 3,5 млн: проходит минимальные суммы промокодов WELCOME и (вместе с платой) REDCORE10
  cpu = ru.products.find(
    (p) => p.componentType === 'cpu' && p.available > 5 && p.priceUzs > 3_500_000,
  )!;
  board = ru.products.find(
    (p) =>
      p.componentType === 'motherboard' &&
      p.available > 3 &&
      (p.specs as { socket: string }).socket === (cpu.specs as { socket: string }).socket,
  )!;
});

afterAll(async () => {
  await testDb.close();
});

const stockOf = async (id: string) =>
  (
    await db
      .select({ stock: products.stockQty, reserved: products.reservedQty })
      .from(products)
      .where(eq(products.id, id))
  )[0]!;

function orderInput(over: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  return {
    checkoutAttemptId: randomUUID(),
    items: [{ slug: cpu.slug, qty: 1 }],
    contact: { name: 'Азиз Каримов', phone: '+998 90 123 45 67' },
    zoneCode: 'pickup',
    paymentMethod: 'cod',
    ...over,
  };
}

const place = (over: Partial<PlaceOrderInput> = {}, userId?: string) =>
  placeOrder(db, ru, orderInput(over), { locale: 'ru', cardEnabled: true, userId });

async function deliver(outcome: 'success' | 'declined' | 'expired', orderId: string) {
  const rows = await db.select().from(payments).where(eq(payments.orderId, orderId));
  const latest = rows.sort((a, b) => b.attempt - a.attempt)[0]!;
  const { payload, signature } = buildMockEvent(outcome, {
    id: latest.checkoutSessionId!,
    orderId,
    amountMinor: latest.amountMinor,
    currency: latest.currency,
  });
  const event = gateway.constructEvent(payload, signature);
  return { event, result: await handleStripeEvent(db, event) };
}

describe('расчёт корзины', () => {
  it('промокод, доставка и услуга сборки', async () => {
    const q = await quoteCart(db, ru, {
      items: [
        { slug: cpu.slug, qty: 1 },
        { slug: board.slug, qty: 1 },
      ],
      zoneCode: 'tashkent-city',
      serviceKeys: ['pc_assembly'],
      promoCode: 'redcore10',
    });
    expect(q.services.map((s) => s.key)).toContain('pc_assembly');
    expect(q.quote.servicesUzs).toBe(350_000);
    expect(q.quote.promo).toEqual({ code: 'REDCORE10', applied: true });
    expect(q.quote.discountUzs).toBeGreaterThan(0);
    expect(q.quote.totalUzs).toBe(
      q.quote.subtotalUzs - q.quote.discountUzs + q.quote.deliveryUzs + 350_000,
    );
  });

  it('несуществующий и истёкший промокод — понятная ошибка, не исключение', async () => {
    const unknown = await quoteCart(db, ru, {
      items: [{ slug: cpu.slug, qty: 1 }],
      promoCode: 'NOPE',
    });
    expect(unknown.quote.promo).toMatchObject({ applied: false, error: 'not_found' });
    const expired = await quoteCart(db, ru, {
      items: [{ slug: cpu.slug, qty: 1 }],
      promoCode: 'SUMMER2026',
    });
    expect(expired.quote.promo).toMatchObject({ applied: false, error: 'expired' });
  });

  it('без процессора и платы сборку не предлагаем; неизвестные товары отмечаются', async () => {
    const q = await quoteCart(db, ru, {
      items: [
        { slug: cpu.slug, qty: 1 },
        { slug: 'gone', qty: 1 },
      ],
      serviceKeys: ['pc_assembly'],
    });
    expect(q.services).toEqual([]);
    expect(q.selectedServices).toEqual([]);
    expect(q.missing).toEqual(['gone']);
  });
});

describe('оформление заказа', () => {
  it('наложенный платёж: заказ, резерв и история', async () => {
    const before = await stockOf(cpu.id);
    const placed = await place();
    expect(placed.number).toMatch(/^RC-\d{4}-\d{6}$/);
    const after = await stockOf(cpu.id);
    expect(after.reserved).toBe(before.reserved + 1);
    expect(after.stock).toBe(before.stock);

    const view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order).toMatchObject({
      status: 'created',
      paymentStatus: 'unpaid',
      paymentMethod: 'cod',
      contactPhone: '+998901234567',
    });
    expect(view.history.map((h) => h.toStatus)).toEqual(['created']);
    expect(view.items[0]).toMatchObject({ sku: cpu.sku, qty: 1, priceUzs: cpu.priceUzs });
  });

  it('повторный клик с тем же checkoutAttemptId не создаёт второй заказ', async () => {
    const input = orderInput();
    const first = await placeOrder(db, ru, input, { locale: 'ru', cardEnabled: true });
    const second = await placeOrder(db, ru, input, { locale: 'ru', cardEnabled: true });
    expect(second).toMatchObject({ orderId: first.orderId, reused: true });
  });

  it('валидация: адрес для курьера, COD в Каракалпакстан, телефон, карта без шлюза', async () => {
    await expect(place({ zoneCode: 'tashkent-city' })).rejects.toMatchObject({
      code: 'address_required',
    });
    const address = { city: 'Нукус', street: 'Досназарова', house: '1' };
    await expect(place({ zoneCode: 'karakalpakstan', address })).rejects.toMatchObject({
      code: 'cod_not_allowed',
    });
    await expect(
      place({ contact: { name: 'Test', phone: '+7 916 000 00 00' } }),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      placeOrder(db, ru, orderInput({ paymentMethod: 'card' }), {
        locale: 'ru',
        cardEnabled: false,
      }),
    ).rejects.toMatchObject({ code: 'card_disabled' });
  });

  it('промокод «на первый заказ» второй раз не применяется', async () => {
    const items = [{ slug: cpu.slug, qty: 1 }];
    const phone = '+998 93 555 44 33';
    await place({ items, promoCode: 'WELCOME', contact: { name: 'Нодира', phone } });
    await expect(
      place({ items, promoCode: 'WELCOME', contact: { name: 'Нодира', phone } }),
    ).rejects.toMatchObject({
      code: 'promo',
      details: 'per_user_limit',
    });
  });

  it('параллельная покупка последней единицы — без овер-селла', async () => {
    const product = ru.products.find((p) => p.componentType === 'gpu' && p.available > 0)!;
    await db
      .update(products)
      .set({ stockQty: 1, reservedQty: 0 })
      .where(eq(products.id, product.id));
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => place({ items: [{ slug: product.slug, qty: 1 }] })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(4);
    for (const f of failed)
      expect(f.reason).toMatchObject({ code: 'out_of_stock', details: [product.slug] });
    expect(await stockOf(product.id)).toEqual({ stock: 1, reserved: 1 });
  });

  it('отмена покупателем снимает резерв', async () => {
    const before = await stockOf(cpu.id);
    const placed = await place();
    await cancelOrderByCustomer(db, placed.orderId);
    expect(await stockOf(cpu.id)).toEqual(before);
    const movements = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, placed.orderId));
    expect(movements.map((m) => [m.reason, m.delta])).toEqual([
      ['reserve', 1],
      ['release', -1],
    ]);
  });
});

describe('оплата картой через вебхук', () => {
  it('4242: «оплачен» только после вебхука, остаток списан', async () => {
    const before = await stockOf(cpu.id);
    const placed = await place({ paymentMethod: 'card' });
    const session = await startPayment(db, gateway, placed.orderId, payOptions);
    expect(session.clientSecret).toContain(session.sessionId);

    let view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order).toMatchObject({
      status: 'pending_payment',
      paymentStatus: 'pending',
      chargeCurrency: 'uzs',
    });
    expect(view.order.chargeAmountMinor).toBe(view.order.totalUzs * 100);

    const { result } = await deliver('success', placed.orderId);
    expect(result).toEqual({
      status: 'processed',
      events: [{ kind: 'paid', orderId: placed.orderId }],
    });
    view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order).toMatchObject({ status: 'paid', paymentStatus: 'paid' });
    expect(view.payments[0]).toMatchObject({ status: 'succeeded' });
    expect(await stockOf(cpu.id)).toEqual({ stock: before.stock - 1, reserved: before.reserved });
  });

  it('повтор события (stripe events resend) ничего не меняет', async () => {
    const placed = await place({ paymentMethod: 'card' });
    await startPayment(db, gateway, placed.orderId, payOptions);
    const { event } = await deliver('success', placed.orderId);
    const stockAfterPaid = await stockOf(cpu.id);
    const historyBefore = (await getOrderByNumber(db, placed.number))!.history.length;

    expect(await handleStripeEvent(db, event)).toEqual({ status: 'duplicate', events: [] });
    // Другое событие о той же оплате (новый evt_) — no-op по машине состояний
    const again = await deliver('success', placed.orderId);
    expect(again.result.events).toEqual([]);
    expect(await stockOf(cpu.id)).toEqual(stockAfterPaid);
    expect((await getOrderByNumber(db, placed.number))!.history).toHaveLength(historyBefore);
  });

  it('9995: отказ — заказ ждёт оплаты, повторная попытка создаёт новую сессию', async () => {
    const placed = await place({ paymentMethod: 'card' });
    const first = await startPayment(db, gateway, placed.orderId, payOptions);
    await deliver('declined', placed.orderId);
    let view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order.status).toBe('pending_payment');
    expect(view.payments[0]).toMatchObject({
      status: 'pending',
      failureCode: 'insufficient_funds',
    });

    // Открытая сессия переиспользуется (Stripe даёт повторить в той же форме)
    expect((await startPayment(db, gateway, placed.orderId, payOptions)).sessionId).toBe(
      first.sessionId,
    );
    await db
      .update(payments)
      .set({ status: 'failed' })
      .where(eq(payments.checkoutSessionId, first.sessionId));
    const retry = await startPayment(db, gateway, placed.orderId, payOptions);
    expect(retry.sessionId).not.toBe(first.sessionId);
    await deliver('success', placed.orderId);
    view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order.status).toBe('paid');
    expect(view.payments.map((p) => p.attempt)).toEqual([2, 1]);
  });

  it('истечение сессии: заказ отменён, резерв освобождён', async () => {
    const before = await stockOf(cpu.id);
    const placed = await place({ paymentMethod: 'card' });
    await startPayment(db, gateway, placed.orderId, payOptions);
    expect((await stockOf(cpu.id)).reserved).toBe(before.reserved + 1);
    const { result } = await deliver('expired', placed.orderId);
    expect(result.events).toEqual([
      { kind: 'cancelled', orderId: placed.orderId, reason: 'payment_expired' },
    ]);
    const view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order).toMatchObject({
      status: 'cancelled',
      paymentStatus: 'failed',
      cancelReason: 'payment_expired',
    });
    expect(await stockOf(cpu.id)).toEqual(before);
  });

  it('потерянный вебхук: просроченные заказы отменяются по расписанию', async () => {
    const placed = await place({ paymentMethod: 'card' });
    const session = await startPayment(db, gateway, placed.orderId, payOptions);
    expect(await expireStaleOrders(db, new Date())).toEqual([]);
    const events = await expireStaleOrders(
      db,
      new Date(session.expiresAt.getTime() + 10 * 60 * 1000),
    );
    expect(events).toContainEqual({
      kind: 'cancelled',
      orderId: placed.orderId,
      reason: 'payment_expired',
    });
  });

  it('сумма в событии не совпадает с заказом — событие не применяется', async () => {
    const placed = await place({ paymentMethod: 'card' });
    const session = await startPayment(db, gateway, placed.orderId, payOptions);
    const { payload, signature } = buildMockEvent('success', {
      id: session.sessionId,
      orderId: placed.orderId,
      amountMinor: 100,
      currency: 'uzs',
    });
    await expect(handleStripeEvent(db, gateway.constructEvent(payload, signature))).rejects.toThrow(
      /Amount mismatch/,
    );
    expect((await getOrderByNumber(db, placed.number))!.order.status).toBe('pending_payment');
  });

  it('неверная подпись отклоняется', () => {
    const { payload } = buildMockEvent('success', {
      id: 'cs_mock_x',
      orderId: 'x',
      amountMinor: 1,
      currency: 'uzs',
    });
    expect(() => gateway.constructEvent(payload, signTestEvent(payload, 'whsec_other'))).toThrow();
  });

  it('полный возврат (charge.refunded) переводит заказ в «возвращён»', async () => {
    const placed = await place({ paymentMethod: 'card' });
    await startPayment(db, gateway, placed.orderId, payOptions);
    await deliver('success', placed.orderId);
    const [payment] = await db.select().from(payments).where(eq(payments.orderId, placed.orderId));
    const payload = JSON.stringify({
      id: `evt_refund_${placed.orderId}`,
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_1',
          object: 'charge',
          payment_intent: payment!.paymentIntentId,
          amount_refunded: payment!.amountMinor,
        },
      },
    });
    const event = gateway.constructEvent(
      payload,
      signTestEvent(payload, 'whsec_redcore_mock_gateway_local_only'),
    );
    await handleStripeEvent(db, event);
    const view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });
  });
});

describe('доступ, уведомления, аккаунт', () => {
  it('гость видит заказ по токену, чужой пользователь — нет', async () => {
    const placed = await place();
    const view = (await getOrderByNumber(db, placed.number))!;
    expect(canViewOrder(view, { token: placed.accessToken })).toBe(true);
    expect(canViewOrder(view, { token: 'wrong' })).toBe(false);
    expect(canViewOrder(view, { userId: 'someone' })).toBe(false);
    expect(canViewOrder(view, { role: 'manager' })).toBe(true);
  });

  it('слияние корзин и адреса пользователя', async () => {
    expect(
      mergeCartLines(
        [{ slug: 'a', qty: 2 }],
        [
          { slug: 'a', qty: 1 },
          { slug: 'b', qty: 3 },
        ],
      ),
    ).toEqual([
      { slug: 'a', qty: 2 },
      { slug: 'b', qty: 3 },
    ]);
    const userId = 'demo-customer';
    await mergeUserCart(db, userId, [{ slug: cpu.slug, qty: 2 }]);
    expect(
      await mergeUserCart(db, userId, [
        { slug: cpu.slug, qty: 1 },
        { slug: 'unknown', qty: 1 },
      ]),
    ).toHaveLength(2);
    expect(await getUserCart(db, userId)).toEqual([{ slug: cpu.slug, qty: 2 }]);

    await saveAddress(db, userId, {
      zoneCode: 'tashkent-city',
      recipient: 'Азиз',
      phone: '90 123 45 67',
      city: 'Ташкент',
      street: 'Амира Темура',
      house: '1',
      landmark: 'напротив метро',
    });
    const list = await listAddresses(db, userId);
    expect(list[0]?.address).toMatchObject({ isDefault: true, phone: '+998901234567' });
  });

  it('ошибки оформления типизированы', () => {
    expect(new CheckoutError('empty')).toBeInstanceOf(Error);
  });
});
