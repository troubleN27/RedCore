import {
  orderItems,
  orderServices,
  orderStatusHistory,
  orders,
  payments,
  refunds,
  stripeEvents,
  type Database,
  type OrderRow,
} from '@redcore/db';
import {
  canTransition,
  commitsStock,
  paymentStatusAfter,
  releasesReservation,
  toChargeMinor,
  type OrderActor,
  type OrderStatus,
} from '@redcore/domain';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { PAYMENT_WINDOW_MS, type PaymentGateway } from './gateway';
import { commitStock, OutOfStockError, releaseStock, reserveStock, type DbOrTx } from './inventory';

export type OrderEvent =
  | { kind: 'paid'; orderId: string }
  | { kind: 'cancelled'; orderId: string; reason: 'payment_expired' | 'customer' | 'admin' }
  /** Смена статуса исполнения менеджером — покупателю в Telegram */
  | { kind: 'status'; orderId: string; status: 'assembling' | 'shipped' | 'delivered' }
  | { kind: 'refunded'; orderId: string; amountMinor: number; currency: string };

export class OrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
    public readonly reason: string,
  ) {
    super(`Order transition ${from} → ${to} rejected: ${reason}`);
  }
}

async function itemLines(tx: DbOrTx, orderId: string) {
  return tx
    .select({ productId: orderItems.productId, qty: orderItems.qty })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
}

/**
 * Единая точка смены статуса: проверка по машине состояний, статус оплаты,
 * движения склада и запись в историю. Повтор того же статуса — no-op (false).
 */
export async function transitionOrder(
  tx: DbOrTx,
  order: OrderRow,
  to: OrderStatus,
  actor: { type: OrderActor; id?: string | null },
  extra: { note?: string; cancelReason?: string; now?: Date } = {},
): Promise<boolean> {
  const check = canTransition({
    from: order.status,
    to,
    actor: actor.type,
    method: order.paymentMethod,
  });
  if (!check.ok) throw new OrderTransitionError(order.status, to, check.reason);
  if (check.idempotent) return false;

  const now = extra.now ?? new Date();
  const paymentStatus = paymentStatusAfter(to, order.paymentMethod, order.paymentStatus);
  const lines = await itemLines(tx, order.id);
  if (commitsStock(to, order.paymentMethod)) await commitStock(tx, order.id, lines);
  // Резерв снимаем, только если товар ещё не списан окончательно
  const committed =
    order.paymentMethod === 'card'
      ? order.paidAt !== null
      : ['assembling', 'shipped', 'delivered'].includes(order.status);
  // У черновика (от MCP/AI) резерва ещё нет — снимать нечего
  if (releasesReservation(to) && !committed && order.status !== 'draft')
    await releaseStock(tx, order.id, lines);

  await tx
    .update(orders)
    .set({
      status: to,
      paymentStatus,
      updatedAt: now,
      ...(to === 'paid' ? { paidAt: now } : {}),
      ...(to === 'cancelled' ? { cancelledAt: now, cancelReason: extra.cancelReason ?? null } : {}),
    })
    .where(eq(orders.id, order.id));
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: to,
    paymentStatus,
    actorType: actor.type,
    actorId: actor.id ?? null,
    note: extra.note ?? null,
    createdAt: now,
  });
  Object.assign(order, { status: to, paymentStatus });
  return true;
}

async function lockOrder(tx: DbOrTx, orderId: string): Promise<OrderRow | null> {
  const [row] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
  return row ?? null;
}

// ── Запуск оплаты ──

export interface PaymentStartOptions {
  siteUrl: string;
  chargeCurrency: 'uzs' | 'usd';
  usdRate?: number;
  now?: Date;
}

export class PaymentNotAvailableError extends Error {
  constructor(public readonly reason: 'not_card' | 'status' | 'not_found') {
    super(`Payment not available: ${reason}`);
  }
}

/**
 * Сессия оплаты для заказа: открытая сессия переиспользуется, после отказа карты или
 * истечения создаётся новая попытка (attempt + 1) с отдельным idempotency key.
 */
export async function startPayment(
  db: Database,
  gateway: PaymentGateway,
  orderId: string,
  options: PaymentStartOptions,
): Promise<{
  sessionId: string;
  clientSecret: string;
  provider: PaymentGateway['provider'];
  expiresAt: Date;
}> {
  const now = options.now ?? new Date();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new PaymentNotAvailableError('not_found');
  if (order.paymentMethod !== 'card') throw new PaymentNotAvailableError('not_card');
  if (order.status !== 'created' && order.status !== 'pending_payment')
    throw new PaymentNotAvailableError('status');

  const [latest] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.attempt))
    .limit(1);
  if (
    latest?.status === 'pending' &&
    latest.checkoutSessionId &&
    order.paymentExpiresAt &&
    order.paymentExpiresAt > now
  ) {
    const info = await gateway.getCheckoutSession(latest.checkoutSessionId);
    if (info.status === 'open' && info.clientSecret) {
      return {
        sessionId: latest.checkoutSessionId,
        clientSecret: info.clientSecret,
        provider: gateway.provider,
        expiresAt: order.paymentExpiresAt,
      };
    }
  }

  const [items, extras] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(orderServices).where(eq(orderServices.orderId, orderId)),
  ]);
  const currency = options.chargeCurrency;
  const amountMinor = toChargeMinor(order.totalUzs, currency, options.usdRate);
  const lineItems =
    currency === 'uzs'
      ? [
          ...items.map((i) => ({
            name: i.qty > 1 ? `${i.name} × ${i.qty}` : i.name,
            amountMinor: (i.priceUzs * i.qty - i.discountUzs) * 100,
          })),
          ...extras.map((s) => ({
            name: s.name[order.locale as 'ru' | 'uz'] ?? s.key,
            amountMinor: s.priceUzs * 100,
          })),
          ...(order.deliveryUzs > 0
            ? [
                {
                  name: order.locale === 'uz' ? 'Yetkazib berish' : 'Доставка',
                  amountMinor: order.deliveryUzs * 100,
                },
              ]
            : []),
        ].filter((line) => line.amountMinor > 0)
      : // В USD позиции не пересчитываем по отдельности — округления разошлись бы с итогом
        [{ name: `RedCore ${order.number}`, amountMinor }];

  const attempt = (latest?.attempt ?? 0) + 1;
  const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MS);
  const session = await gateway.createCheckoutSession({
    orderId,
    number: order.number,
    attempt,
    currency,
    amountMinor,
    lineItems,
    email: order.contactEmail,
    locale: order.locale as 'ru' | 'uz',
    returnUrl: `${options.siteUrl}/${order.locale}/orders/${order.number}?token=${order.accessToken}`,
    expiresAt,
  });

  await db.transaction(async (tx) => {
    // Прошлые незавершённые попытки больше не действуют
    await tx
      .update(payments)
      .set({ status: 'expired', updatedAt: now })
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'pending')));
    await tx.insert(payments).values({
      orderId,
      provider: gateway.provider,
      attempt,
      checkoutSessionId: session.sessionId,
      amountMinor,
      currency,
      status: 'pending',
    });
    const locked = (await lockOrder(tx, orderId))!;
    if (locked.status === 'created')
      await transitionOrder(tx, locked, 'pending_payment', { type: 'system' }, { now });
    await tx
      .update(orders)
      .set({
        paymentExpiresAt: expiresAt,
        chargeCurrency: currency,
        chargeAmountMinor: amountMinor,
        fxRate: currency === 'usd' && options.usdRate ? String(options.usdRate) : null,
      })
      .where(eq(orders.id, orderId));
  });
  return { ...session, provider: gateway.provider, expiresAt };
}

// ── Вебхук ──

export type WebhookResult = { status: 'processed' | 'duplicate' | 'ignored'; events: OrderEvent[] };

const handledTypes = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'charge.refunded',
]);

/**
 * Обработка события Stripe. Идемпотентность — по id события (stripe_events.id) и по
 * машине состояний: повтор «оплачено» для оплаченного заказа ничего не меняет.
 */
export async function handleStripeEvent(db: Database, event: Stripe.Event): Promise<WebhookResult> {
  const inserted = await db
    .insert(stripeEvents)
    .values({
      id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  if (inserted.length === 0) {
    const [previous] = await db
      .select({ status: stripeEvents.status })
      .from(stripeEvents)
      .where(eq(stripeEvents.id, event.id));
    // Упавшее ранее событие Stripe пришлёт повторно — его обрабатываем ещё раз
    if (previous?.status !== 'failed') return { status: 'duplicate', events: [] };
  }
  if (!handledTypes.has(event.type)) {
    await markEvent(db, event.id, 'ignored');
    return { status: 'ignored', events: [] };
  }

  try {
    const events = await db.transaction((tx) => applyEvent(tx, event));
    await markEvent(db, event.id, 'processed');
    return { status: 'processed', events };
  } catch (error) {
    await markEvent(db, event.id, 'failed', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function markEvent(
  db: Database,
  id: string,
  status: 'processed' | 'ignored' | 'failed',
  error?: string,
) {
  await db
    .update(stripeEvents)
    .set({ status, error: error ?? null, processedAt: sql`now()` })
    .where(eq(stripeEvents.id, id));
}

function orderIdOf(object: { metadata?: Stripe.Metadata | null }): string | null {
  return object.metadata?.orderId ?? null;
}

async function applyEvent(tx: DbOrTx, event: Stripe.Event): Promise<OrderEvent[]> {
  const now = new Date();
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      // completed с payment_status=unpaid — асинхронный способ оплаты, ждём async_payment_*
      if (session.payment_status !== 'paid') return [];
      return markPaid(tx, session, now);
    }
    case 'checkout.session.async_payment_failed': {
      await tx
        .update(payments)
        .set({ status: 'failed', updatedAt: now })
        .where(eq(payments.checkoutSessionId, event.data.object.id));
      return [];
    }
    case 'checkout.session.expired': {
      const session = event.data.object;
      await tx
        .update(payments)
        .set({ status: 'expired', updatedAt: now })
        .where(and(eq(payments.checkoutSessionId, session.id), eq(payments.status, 'pending')));
      const orderId = orderIdOf(session);
      if (!orderId) return [];
      return cancelIfNoActivePayment(tx, orderId, now);
    }
    case 'payment_intent.payment_failed': {
      // Отказ карты: заказ остаётся «ожидает оплаты», покупатель может повторить
      const intent = event.data.object;
      const orderId = orderIdOf(intent);
      if (!orderId) return [];
      const [latest] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.orderId, orderId), eq(payments.status, 'pending')))
        .orderBy(desc(payments.attempt))
        .limit(1);
      if (latest) {
        await tx
          .update(payments)
          .set({
            paymentIntentId: intent.id,
            failureCode:
              intent.last_payment_error?.decline_code ??
              intent.last_payment_error?.code ??
              'failed',
            updatedAt: now,
          })
          .where(eq(payments.id, latest.id));
      }
      return [];
    }
    case 'charge.refunded': {
      const charge = event.data.object;
      const intentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!intentId) return [];
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.paymentIntentId, intentId));
      if (!payment) return [];
      const full = charge.amount_refunded >= payment.amountMinor;
      // Все запрошенные возвраты по платежу считаем проведёнными: Stripe прислал итоговую сумму
      await tx
        .update(refunds)
        .set({ status: 'succeeded' })
        .where(and(eq(refunds.paymentId, payment.id), eq(refunds.status, 'pending')));
      await tx
        .update(payments)
        .set({
          refundedMinor: charge.amount_refunded,
          status: full ? 'refunded' : 'partially_refunded',
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));
      const order = await lockOrder(tx, payment.orderId);
      if (!order) return [];
      if (full) {
        if (order.status !== 'refunded')
          await transitionOrder(tx, order, 'refunded', { type: 'webhook' }, { now });
      } else {
        await tx
          .update(orders)
          .set({ paymentStatus: 'partially_refunded', updatedAt: now })
          .where(eq(orders.id, order.id));
      }
      const delta = charge.amount_refunded - payment.refundedMinor;
      return delta > 0
        ? [{ kind: 'refunded', orderId: order.id, amountMinor: delta, currency: payment.currency }]
        : [];
    }
    default:
      return [];
  }
}

async function markPaid(
  tx: DbOrTx,
  session: Stripe.Checkout.Session,
  now: Date,
): Promise<OrderEvent[]> {
  const orderId = orderIdOf(session);
  if (!orderId) return [];
  const intentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  await tx
    .update(payments)
    .set({ status: 'succeeded', paymentIntentId: intentId, updatedAt: now })
    .where(eq(payments.checkoutSessionId, session.id));

  const order = await lockOrder(tx, orderId);
  if (!order) return [];
  if (order.status === 'paid' || order.paidAt) return [];
  if (
    session.amount_total !== null &&
    order.chargeAmountMinor !== null &&
    session.amount_total !== order.chargeAmountMinor
  ) {
    throw new Error(
      `Amount mismatch for ${order.number}: ${session.amount_total} ≠ ${order.chargeAmountMinor}`,
    );
  }
  if (order.status !== 'pending_payment') {
    // Оплата пришла после отмены (истёк срок) — деньги нужно вернуть вручную из админки
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      paymentStatus: order.paymentStatus,
      actorType: 'webhook',
      note: 'late_payment_refund_required',
      createdAt: now,
    });
    return [];
  }
  await transitionOrder(tx, order, 'paid', { type: 'webhook' }, { now });
  return [{ kind: 'paid', orderId }];
}

async function cancelIfNoActivePayment(
  tx: DbOrTx,
  orderId: string,
  now: Date,
): Promise<OrderEvent[]> {
  const order = await lockOrder(tx, orderId);
  if (!order || order.status !== 'pending_payment') return [];
  const active = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), inArray(payments.status, ['pending', 'succeeded'])));
  if (active.length > 0) return [];
  await transitionOrder(
    tx,
    order,
    'cancelled',
    { type: 'webhook' },
    { now, cancelReason: 'payment_expired' },
  );
  return [{ kind: 'cancelled', orderId, reason: 'payment_expired' }];
}

/**
 * Страховка на случай потерянного вебхука (и для мок-шлюза): отменяет заказы,
 * срок оплаты которых истёк больше `graceMs` назад. Вызывается по cron и при открытии заказа.
 */
export async function expireStaleOrders(
  db: Database,
  now = new Date(),
  graceMs = 5 * 60 * 1000,
): Promise<OrderEvent[]> {
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'pending_payment'),
        lt(orders.paymentExpiresAt, new Date(now.getTime() - graceMs)),
      ),
    );
  const events: OrderEvent[] = [];
  for (const { id } of stale) {
    events.push(
      ...(await db.transaction(async (tx) => {
        await tx
          .update(payments)
          .set({ status: 'expired', updatedAt: now })
          .where(and(eq(payments.orderId, id), eq(payments.status, 'pending')));
        return cancelIfNoActivePayment(tx, id, now);
      })),
    );
  }
  return events;
}

export class DraftConfirmError extends Error {
  constructor(public readonly reason: 'not_found' | 'not_draft' | 'out_of_stock') {
    super(`Draft confirm failed: ${reason}`);
  }
}

/**
 * Подтверждение черновика покупателем: товар резервируется только сейчас (ассистент и MCP
 * не держат склад), заказ становится обычным «создан» — дальше оплата как при оформлении.
 */
export async function confirmDraftOrder(
  db: Database,
  orderId: string,
  userId?: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw new DraftConfirmError('not_found');
    if (order.status !== 'draft') throw new DraftConfirmError('not_draft');
    try {
      await reserveStock(tx, order.id, await itemLines(tx, order.id));
    } catch (error) {
      if (error instanceof OutOfStockError) throw new DraftConfirmError('out_of_stock');
      throw error;
    }
    await transitionOrder(tx, order, 'created', { type: 'customer', id: userId });
  });
}

/** Отмена покупателем — пока заказ не оплачен и не передан в работу. */
export async function cancelOrderByCustomer(
  db: Database,
  orderId: string,
  userId?: string | null,
): Promise<OrderEvent[]> {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) return [];
    await transitionOrder(
      tx,
      order,
      'cancelled',
      { type: 'customer', id: userId },
      { cancelReason: 'customer' },
    );
    await tx
      .update(payments)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'pending')));
    return [{ kind: 'cancelled', orderId, reason: 'customer' }];
  });
}
