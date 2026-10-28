import {
  inventoryMovements,
  orderItems,
  orders,
  payments,
  products,
  refunds,
  type Database,
} from '@redcore/db';
import { nextStatuses, orderStatuses, type OrderStatus } from '@redcore/domain';
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { PaymentGateway } from '../orders/gateway';
import { transitionOrder, type OrderEvent } from '../orders/payments';

export const ADMIN_PAGE_SIZE = 25;

export async function listAdminOrders(
  db: Database,
  filter: { status?: string; q?: string; page?: number },
) {
  const page = Math.max(1, filter.page ?? 1);
  const conditions: SQL[] = [];
  if (filter.status && (orderStatuses as readonly string[]).includes(filter.status)) {
    conditions.push(eq(orders.status, filter.status as OrderStatus));
  }
  const q = filter.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    conditions.push(
      or(
        ilike(orders.number, like),
        ilike(orders.contactPhone, like),
        ilike(orders.contactName, like),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.number,
        createdAt: orders.createdAt,
        contactName: orders.contactName,
        contactPhone: orders.contactPhone,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        totalUzs: orders.totalUzs,
        itemCount: sql<number>`(select coalesce(sum(qty), 0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: count() }).from(orders).where(where),
  ]);
  return {
    rows,
    total: total?.n ?? 0,
    page,
    pages: Math.max(1, Math.ceil((total?.n ?? 0) / ADMIN_PAGE_SIZE)),
  };
}

/** Переходы, которые сотрудник может выполнить из текущего статуса. */
export function adminNextStatuses(status: OrderStatus, method: 'card' | 'cod'): OrderStatus[] {
  // Возврат по карте — отдельным действием (через платёжную систему), не кнопкой статуса
  return nextStatuses(status, 'admin', method).filter(
    (s) => !(s === 'refunded' && method === 'card'),
  );
}

export async function adminTransitionOrder(
  db: Database,
  orderId: string,
  to: OrderStatus,
  staffId: string,
  note?: string,
): Promise<{ from: OrderStatus; events: OrderEvent[] }> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) throw new Error('order not found');
    const from = order.status;
    await transitionOrder(
      tx,
      order,
      to,
      { type: 'admin', id: staffId },
      { note, cancelReason: to === 'cancelled' ? 'admin' : undefined },
    );
    const events: OrderEvent[] =
      to === 'cancelled'
        ? [{ kind: 'cancelled', orderId, reason: 'admin' }]
        : to === 'assembling' || to === 'shipped' || to === 'delivered'
          ? [{ kind: 'status', orderId, status: to }]
          : [];
    return { from, events };
  });
}

export class RefundError extends Error {
  constructor(public readonly reason: 'no_payment' | 'amount' | 'status') {
    super(`Refund rejected: ${reason}`);
  }
}

/**
 * Возврат по оплаченному картой заказу: запись refunds, запрос в платёжную систему
 * (idempotency key refund:<id>), по желанию — товары обратно на склад. Статус заказа и
 * платежа меняет вебхук charge.refunded.
 */
export async function requestRefund(
  db: Database,
  gateway: PaymentGateway,
  orderId: string,
  input: { amountUzs?: number; restock: boolean; reason?: string; staffId: string },
) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order || order.paymentMethod !== 'card') throw new RefundError('status');
  if (!['paid', 'assembling', 'shipped', 'delivered'].includes(order.status))
    throw new RefundError('status');
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.orderId, orderId),
        inArray(payments.status, ['succeeded', 'partially_refunded']),
      ),
    );
  if (!payment?.paymentIntentId) throw new RefundError('no_payment');

  const remaining = payment.amountMinor - payment.refundedMinor;
  const amountMinor = input.amountUzs ? input.amountUzs * 100 : remaining;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > remaining)
    throw new RefundError('amount');

  const [refund] = await db
    .insert(refunds)
    .values({
      paymentId: payment.id,
      amountMinor,
      reason: input.reason || null,
      restock: input.restock,
      createdBy: input.staffId,
    })
    .returning();
  const { refundId } = await gateway.createRefund({
    paymentIntentId: payment.paymentIntentId,
    amountMinor,
    idempotencyKey: `refund:${refund!.id}`,
  });
  await db.update(refunds).set({ providerRefundId: refundId }).where(eq(refunds.id, refund!.id));

  if (input.restock) {
    // Товар физически вернулся — возвращаем его в остаток
    const lines = await db
      .select({ productId: orderItems.productId, qty: orderItems.qty })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    await db.transaction(async (tx) => {
      for (const line of lines) {
        await tx
          .update(products)
          .set({ stockQty: sql`${products.stockQty} + ${line.qty}` })
          .where(eq(products.id, line.productId));
      }
      await tx.insert(inventoryMovements).values(
        lines.map((l) => ({
          productId: l.productId,
          orderId,
          delta: l.qty,
          reason: 'return' as const,
          note: input.reason ?? null,
        })),
      );
    });
  }
  return {
    refundId: refund!.id,
    providerRefundId: refundId,
    payment: { ...payment, refundedAfterMinor: payment.refundedMinor + amountMinor },
  };
}
