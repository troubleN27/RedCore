import {
  deliveryZones,
  orderItems,
  orderServices,
  orderStatusHistory,
  orders,
  payments,
  promoCodes,
  settings,
  type Database,
} from '@redcore/db';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';

export async function getOrderByNumber(db: Database, number: string) {
  const [order] = await db.select().from(orders).where(eq(orders.number, number));
  if (!order) return null;
  const [items, extras, history, paymentRows, zoneRows, promoRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(orderServices).where(eq(orderServices.orderId, order.id)),
    db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, order.id))
      .orderBy(asc(orderStatusHistory.createdAt)),
    db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.attempt)),
    db.select().from(deliveryZones).where(eq(deliveryZones.id, order.zoneId)),
    order.promoCodeId
      ? db
          .select({ code: promoCodes.code })
          .from(promoCodes)
          .where(eq(promoCodes.id, order.promoCodeId))
      : [],
  ]);
  return {
    order,
    items,
    services: extras,
    history,
    payments: paymentRows,
    zone: zoneRows[0]!,
    promoCode: promoRows[0]?.code ?? null,
  };
}

export type OrderView = NonNullable<Awaited<ReturnType<typeof getOrderByNumber>>>;

function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Доступ к заказу: владелец-пользователь, либо гость по секретной ссылке, либо персонал. */
export function canViewOrder(
  view: OrderView,
  viewer: { userId?: string | null; role?: string | null; token?: string | null },
): boolean {
  if (viewer.role === 'admin' || viewer.role === 'manager') return true;
  if (view.order.userId && viewer.userId === view.order.userId) return true;
  return Boolean(viewer.token && sameToken(viewer.token, view.order.accessToken));
}

export async function listUserOrders(db: Database, userId: string) {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      paymentMethod: orders.paymentMethod,
      totalUzs: orders.totalUzs,
      createdAt: orders.createdAt,
      itemCount: sql<number>`(select coalesce(sum(qty), 0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

/** Курс USD/UZS из настроек магазина — для режима списания в долларах. */
export async function getUsdRate(db: Database): Promise<number | undefined> {
  const [pricing] = await db.select().from(settings).where(eq(settings.key, 'pricing'));
  return (pricing?.value as { usdUzsRate?: number } | undefined)?.usdUzsRate;
}

export async function getPaymentBySession(db: Database, sessionId: string) {
  const [row] = await db.select().from(payments).where(eq(payments.checkoutSessionId, sessionId));
  return row ?? null;
}
