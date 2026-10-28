import {
  inventoryMovements,
  payments,
  products,
  refunds,
  reviews,
  user,
  type Database,
} from '@redcore/db';
import { createTestDatabase, type TestDatabase } from '@redcore/db/testing';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCatalogSnapshot, invalidateCatalogCache } from '../catalog/snapshot';
import type { CatalogSnapshot } from '../catalog/types';
import { placeOrder } from '../orders/checkout';
import {
  buildMockEvent,
  buildMockRefundEvent,
  createMockGateway,
  type PaymentGateway,
} from '../orders/gateway';
import { getOrderByNumber } from '../orders/queries';
import { handleStripeEvent, startPayment } from '../orders/payments';
import {
  AdminValidationError,
  adjustStock,
  createPromo,
  getAdminProduct,
  listAdminProducts,
  moderateReview,
  saveProduct,
  type ProductInput,
} from './catalog';
import { getDashboard } from './dashboard';
import {
  loginLockedUntil,
  MAX_LOGIN_FAILURES,
  recordLoginFailure,
  resetLoginFailures,
} from './login-guard';
import {
  adminNextStatuses,
  adminTransitionOrder,
  listAdminOrders,
  requestRefund,
  RefundError,
} from './orders';
import { listUsers, setUserRole } from './system';

let testDb: TestDatabase;
let db: Database;
let ru: CatalogSnapshot;
let gateway: PaymentGateway;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  gateway = createMockGateway(db);
  invalidateCatalogCache();
  ru = await getCatalogSnapshot(db, 'ru');
});

afterAll(async () => {
  await testDb.close();
});

const product = () => ru.products.find((p) => p.componentType === 'storage' && p.available > 5)!;

async function paidOrder() {
  const p = product();
  const placed = await placeOrder(
    db,
    ru,
    {
      checkoutAttemptId: randomUUID(),
      items: [{ slug: p.slug, qty: 1 }],
      contact: { name: 'Тест', phone: '+998 90 111 22 33' },
      zoneCode: 'pickup',
      paymentMethod: 'card',
    },
    { locale: 'ru', cardEnabled: true },
  );
  const session = await startPayment(db, gateway, placed.orderId, {
    siteUrl: 'http://x',
    chargeCurrency: 'uzs',
  });
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.checkoutSessionId, session.sessionId));
  const { payload, signature } = buildMockEvent('success', {
    id: session.sessionId,
    orderId: placed.orderId,
    amountMinor: payment!.amountMinor,
    currency: 'uzs',
  });
  await handleStripeEvent(db, gateway.constructEvent(payload, signature));
  return placed;
}

describe('дашборд', () => {
  it('KPI совпадают с контрольными SQL', async () => {
    await paidOrder();
    await paidOrder();
    const data = await getDashboard(db, 'd30');
    const control = (
      (await db.execute(sql`
        select count(*)::int as orders,
               count(*) filter (where payment_status = 'paid')::int as paid,
               coalesce(sum(total_uzs) filter (where payment_status = 'paid'), 0)::bigint as revenue
        from orders where status <> 'draft' and created_at >= now() - interval '30 days'`)) as unknown as {
        rows: { orders: number; paid: number; revenue: string | number }[];
      }
    ).rows[0]!;
    expect(data.orders).toBe(control.orders);
    expect(data.paidOrders).toBe(control.paid);
    expect(data.revenueUzs).toBe(Number(control.revenue));
    expect(data.aovUzs).toBe(Math.round(Number(control.revenue) / control.paid));
    expect(data.daily.reduce((s, d) => s + d.revenueUzs, 0)).toBe(data.revenueUzs);
    expect(data.daily.length).toBeGreaterThanOrEqual(30);
    expect(data.topProducts[0]?.name).toBeTruthy();
  });
});

describe('заказы в консоли', () => {
  it('список с поиском по номеру', async () => {
    const placed = await paidOrder();
    const result = await listAdminOrders(db, { q: placed.number });
    expect(result.rows.map((r) => r.number)).toEqual([placed.number]);
  });

  it('переходы статусов менеджером и история', async () => {
    const placed = await paidOrder();
    expect(adminNextStatuses('paid', 'card')).toEqual(['assembling']);
    await adminTransitionOrder(db, placed.orderId, 'assembling', 'demo-manager', 'собираем');
    await adminTransitionOrder(db, placed.orderId, 'shipped', 'demo-manager');
    const view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order.status).toBe('shipped');
    expect(view.history.at(-1)).toMatchObject({ actorType: 'admin', actorId: 'demo-manager' });
  });

  it('возврат: запрос в шлюз, статус меняет вебхук, товар возвращается на склад', async () => {
    const placed = await paidOrder();
    const p = product();
    const stockBefore = (
      await db.select({ s: products.stockQty }).from(products).where(eq(products.id, p.id))
    )[0]!.s;
    const refund = await requestRefund(db, gateway, placed.orderId, {
      restock: true,
      staffId: 'demo-admin',
      reason: 'брак',
    });
    // До вебхука заказ не меняется
    expect((await getOrderByNumber(db, placed.number))!.order.status).toBe('paid');
    const { payload, signature } = buildMockRefundEvent({
      paymentIntentId: refund.payment.paymentIntentId!,
      amountMinor: refund.payment.amountMinor,
      refundedMinor: refund.payment.refundedAfterMinor,
      currency: 'uzs',
    });
    await handleStripeEvent(db, gateway.constructEvent(payload, signature));
    const view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order).toMatchObject({ status: 'refunded', paymentStatus: 'refunded' });
    const [row] = await db.select().from(refunds).where(eq(refunds.id, refund.refundId));
    expect(row).toMatchObject({ status: 'succeeded', restock: true });
    const stockAfter = (
      await db.select({ s: products.stockQty }).from(products).where(eq(products.id, p.id))
    )[0]!.s;
    expect(stockAfter).toBe(stockBefore + 1);
    const returns = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.orderId, placed.orderId));
    expect(returns.map((m) => m.reason)).toContain('return');
    // Повторный возврат сверх суммы — отказ
    await expect(
      requestRefund(db, gateway, placed.orderId, { restock: false, staffId: 'demo-admin' }),
    ).rejects.toBeInstanceOf(RefundError);
  });

  it('частичный возврат', async () => {
    const placed = await paidOrder();
    const refund = await requestRefund(db, gateway, placed.orderId, {
      amountUzs: 1000,
      restock: false,
      staffId: 'demo-admin',
    });
    const { payload, signature } = buildMockRefundEvent({
      paymentIntentId: refund.payment.paymentIntentId!,
      amountMinor: refund.payment.amountMinor,
      refundedMinor: refund.payment.refundedAfterMinor,
      currency: 'uzs',
    });
    await handleStripeEvent(db, gateway.constructEvent(payload, signature));
    const view = (await getOrderByNumber(db, placed.number))!;
    expect(view.order).toMatchObject({ status: 'paid', paymentStatus: 'partially_refunded' });
  });
});

describe('вход в консоль', () => {
  it(`после ${MAX_LOGIN_FAILURES} ошибок вход блокируется на 15 минут`, async () => {
    const email = 'Admin@RedCore.uz';
    const now = new Date('2026-10-28T10:00:00Z');
    for (let i = 1; i < MAX_LOGIN_FAILURES; i++) {
      expect((await recordLoginFailure(db, email, now)).lockedUntil).toBeNull();
    }
    const { lockedUntil } = await recordLoginFailure(db, email, now);
    expect(lockedUntil?.getTime()).toBe(now.getTime() + 15 * 60 * 1000);
    expect(
      await loginLockedUntil(db, 'admin@redcore.uz', new Date(now.getTime() + 60_000)),
    ).toEqual(lockedUntil);
    expect(
      await loginLockedUntil(db, 'admin@redcore.uz', new Date(now.getTime() + 16 * 60_000)),
    ).toBeNull();
    await resetLoginFailures(db, email);
    expect(await loginLockedUntil(db, email, now)).toBeNull();
  });
});

describe('товары и склад', () => {
  const base = async (): Promise<ProductInput> => {
    const { product: p, ru: tr, uz } = (await getAdminProduct(db, product().id))!;
    return {
      sku: p.sku,
      slug: p.slug,
      name: p.name,
      brandId: p.brandId,
      categoryId: p.categoryId,
      priceUzs: p.priceUzs,
      compareAtPriceUzs: p.compareAtPriceUzs,
      costUzs: p.costUzs,
      status: p.status,
      isFeatured: p.isFeatured,
      warrantyMonths: p.warrantyMonths,
      specs: p.specs as Record<string, unknown>,
      shortRu: tr?.shortDescription ?? '',
      shortUz: uz?.shortDescription ?? '',
      descriptionRu: null,
      descriptionUz: null,
    };
  };

  it('правка цены с diff для аудита', async () => {
    const input = await base();
    const { diff } = await saveProduct(
      db,
      { ...input, priceUzs: input.priceUzs + 10_000 },
      product().id,
    );
    expect(diff.priceUzs).toEqual({ from: input.priceUzs, to: input.priceUzs + 10_000 });
    // Характеристики не трогали — в журнал не попадают
    expect(diff.specs).toBeUndefined();
  });

  it('характеристики проверяются схемой категории', async () => {
    const input = await base();
    await expect(
      saveProduct(db, { ...input, specs: { ...input.specs, capacityGb: -5 } }, product().id),
    ).rejects.toMatchObject({ fields: expect.arrayContaining(['specs.capacityGb']) });
  });

  it('создание товара с переводами', async () => {
    const input = await base();
    const { id } = await saveProduct(db, {
      ...input,
      sku: 'RC-TEST-001',
      slug: 'test-product-001',
      name: 'Тестовый SSD',
    });
    const list = await listAdminProducts(db, { q: 'RC-TEST-001' });
    expect(list.rows.map((r) => r.id)).toEqual([id]);
    const created = (await getAdminProduct(db, id))!;
    expect(created.ru?.source).toBe('human');
  });

  it('остаток нельзя опустить ниже резерва', async () => {
    const p = product();
    await adjustStock(db, p.id, 5, 'поставка');
    const [row] = await db.select().from(products).where(eq(products.id, p.id));
    await expect(
      adjustStock(db, p.id, -(row!.stockQty - row!.reservedQty + 1), 'ошибка'),
    ).rejects.toBeInstanceOf(AdminValidationError);
  });

  it('промокод: дубликат и процент больше 100 отклоняются', async () => {
    const valid = {
      code: 'test15',
      type: 'percent' as const,
      value: 15,
      minOrderUzs: null,
      maxDiscountUzs: null,
      startsAt: null,
      endsAt: null,
      usageLimit: 10,
      perUserLimit: 1,
      isActive: true,
      descriptionRu: '',
      descriptionUz: '',
    };
    expect((await createPromo(db, valid)).code).toBe('TEST15');
    await expect(createPromo(db, valid)).rejects.toBeInstanceOf(AdminValidationError);
    await expect(createPromo(db, { ...valid, code: 'big', value: 150 })).rejects.toBeInstanceOf(
      AdminValidationError,
    );
  });

  it('модерация отзыва пересчитывает рейтинг', async () => {
    const [pending] = await db.select().from(reviews).where(eq(reviews.status, 'pending')).limit(1);
    await moderateReview(db, pending!.id, 'approved', 'demo-manager');
    const [p] = await db.select().from(products).where(eq(products.id, pending!.productId));
    const approved = await db
      .select()
      .from(reviews)
      .where(sql`${reviews.productId} = ${pending!.productId} and ${reviews.status} = 'approved'`);
    expect(p!.ratingCount).toBe(approved.length);
    expect(p!.ratingAvg).toBeCloseTo(
      approved.reduce((s, r) => s + r.rating, 0) / approved.length,
      5,
    );
  });
});

describe('пользователи', () => {
  it('смена роли, но не своей', async () => {
    expect((await setUserRole(db, 'demo-admin', 'demo-customer', 'manager')).to).toBe('manager');
    await expect(setUserRole(db, 'demo-admin', 'demo-admin', 'customer')).rejects.toBeInstanceOf(
      AdminValidationError,
    );
    const [row] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, 'demo-customer'));
    expect(row?.role).toBe('manager');
    expect((await listUsers(db, { q: 'redcore.uz' })).total).toBeGreaterThanOrEqual(3);
  });
});
