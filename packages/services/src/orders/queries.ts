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
import { formatPrice, isLocale, type Locale } from '@redcore/i18n';
import { getTranslator } from '@redcore/i18n/translator';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { orderEmail, type OrderEmailKind } from '../notify/templates';
import { sendEmail, sendSms } from '../notify/notify';
import type { OrderEvent } from './payments';

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

/** Привязка гостевых заказов к аккаунту после входа по тому же телефону. */
export async function claimGuestOrders(
  db: Database,
  userId: string,
  phone: string,
): Promise<number> {
  const claimed = await db
    .update(orders)
    .set({ userId })
    .where(sql`${orders.userId} is null and ${orders.contactPhone} = ${phone}`)
    .returning({ id: orders.id });
  return claimed.length;
}

/**
 * Письмо и SMS о событии заказа на языке заказа. Ошибка провайдера не должна
 * откатывать оплату — поэтому вызывается после транзакции, в after().
 */
export async function notifyOrder(
  db: Database,
  orderId: string,
  event: { kind: 'created'; card: boolean } | OrderEvent,
  siteUrl: string,
): Promise<void> {
  // Письма и SMS — только о создании, оплате и отмене; статусы и возвраты идут в Telegram
  if (event.kind === 'status' || event.kind === 'refunded') return;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return;
  const locale: Locale = isLocale(order.locale) ? order.locale : 'ru';
  const url = `${siteUrl}/${locale}/orders/${order.number}?token=${order.accessToken}`;
  const t = getTranslator(locale);

  if (order.contactEmail) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const kind: OrderEmailKind =
      event.kind === 'created'
        ? event
        : event.kind === 'paid'
          ? { kind: 'paid' }
          : { kind: 'cancelled', reason: event.reason };
    await sendEmail(
      db,
      orderEmail(
        {
          locale,
          to: order.contactEmail,
          name: order.contactName,
          number: order.number,
          url,
          items: items.map((i) => ({ name: i.name, qty: i.qty, totalUzs: i.priceUzs * i.qty })),
          subtotalUzs: order.subtotalUzs,
          discountUzs: order.discountUzs,
          deliveryUzs: order.deliveryUzs,
          servicesUzs: order.servicesUzs,
          totalUzs: order.totalUzs,
        },
        kind,
      ),
    );
  }
  if (event.kind === 'created') {
    await sendSms(db, {
      to: order.contactPhone,
      text: t('emails.order.sms.created', {
        number: order.number,
        amount: formatPrice(order.totalUzs, locale),
        url,
      }),
    });
  } else if (event.kind === 'paid') {
    await sendSms(db, {
      to: order.contactPhone,
      text: t('emails.order.sms.paid', { number: order.number }),
    });
  }
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
