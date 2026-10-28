import { analyticsEvents, builds, orderItems, orders, products, type Database } from '@redcore/db';
import { and, count, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';

// Метрики дашборда. Определения намеренно простые и проверяются контрольными SQL в тестах:
// выручка — сумма оплаченных заказов (payment_status = paid), оформленные — всё, кроме черновиков.

export const dashboardPeriods = { d7: 7, d30: 30, d90: 90 } as const;
export type DashboardPeriod = keyof typeof dashboardPeriods;

const TZ = 'Asia/Tashkent';
// Константа, а не параметр: иначе выражения в select и group by для Postgres различаются
const TZ_SQL = sql.raw(`'${TZ}'`);

export interface DashboardData {
  from: Date;
  to: Date;
  revenueUzs: number;
  orders: number;
  paidOrders: number;
  aovUzs: number;
  paidShare: number;
  conversion: number;
  daily: { day: string; revenueUzs: number; orders: number }[];
  topProducts: { productId: string; name: string; qty: number; revenueUzs: number }[];
  topBuilds: { publicId: string; name: string | null; totalUzs: number; count: number }[];
  funnel: { views: number; saved: number; toCart: number; orders: number };
  lowStock: { id: string; name: string; sku: string; available: number }[];
}

export function periodRange(period: DashboardPeriod, now = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getTime() - dashboardPeriods[period] * 24 * 60 * 60 * 1000);
  return { from, to: now };
}

const paid = eq(orders.paymentStatus, 'paid');

export async function getDashboard(
  db: Database,
  period: DashboardPeriod,
  now = new Date(),
): Promise<DashboardData> {
  const { from, to } = periodRange(period, now);
  const inPeriod = and(gte(orders.createdAt, from), lte(orders.createdAt, to));
  const placed = and(inPeriod, ne(orders.status, 'draft'));

  const [totals] = await db
    .select({
      orders: count(),
      paidOrders: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'paid')::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalUzs}) filter (where ${orders.paymentStatus} = 'paid'), 0)::bigint`,
    })
    .from(orders)
    .where(placed);

  const dayExpr = sql<string>`to_char(date_trunc('day', ${orders.createdAt} at time zone ${TZ_SQL}), 'YYYY-MM-DD')`;
  const dailyRows = await db
    .select({
      day: dayExpr,
      orders: count(),
      revenue: sql<number>`coalesce(sum(${orders.totalUzs}) filter (where ${orders.paymentStatus} = 'paid'), 0)::bigint`,
    })
    .from(orders)
    .where(placed)
    .groupBy(dayExpr);
  const byDay = new Map(dailyRows.map((r) => [r.day, r]));
  const daily: DashboardData['daily'] = [];
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
  for (let t = from.getTime(); t <= to.getTime() + 1; t += 24 * 60 * 60 * 1000) {
    const day = dayFmt.format(new Date(t));
    if (daily.at(-1)?.day === day) continue;
    const row = byDay.get(day);
    daily.push({ day, orders: row?.orders ?? 0, revenueUzs: Number(row?.revenue ?? 0) });
  }

  const lineRevenue = sql<number>`sum(${orderItems.priceUzs} * ${orderItems.qty} - ${orderItems.discountUzs})::bigint`;
  const topProducts = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.name,
      qty: sql<number>`sum(${orderItems.qty})::int`,
      revenueUzs: lineRevenue,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(inPeriod, paid))
    .groupBy(orderItems.productId, orderItems.name)
    .orderBy(desc(lineRevenue))
    .limit(5);

  const buildCount = count();
  const topBuilds = await db
    .select({
      publicId: sql<string>`min(${builds.publicId})`,
      name: sql<string | null>`max(${builds.name})`,
      totalUzs: sql<number>`max(${builds.totalUzs})::bigint`,
      count: buildCount,
    })
    .from(builds)
    .where(and(gte(builds.createdAt, from), lte(builds.createdAt, to)))
    .groupBy(builds.signature)
    .orderBy(desc(buildCount))
    .limit(5);

  const events = await db
    .select({ type: analyticsEvents.type, n: count() })
    .from(analyticsEvents)
    .where(
      and(
        gte(analyticsEvents.createdAt, from),
        lte(analyticsEvents.createdAt, to),
        inArray(analyticsEvents.type, ['configurator_view', 'build_saved', 'build_to_cart']),
      ),
    )
    .groupBy(analyticsEvents.type);
  const eventCount = (type: string) => events.find((e) => e.type === type)?.n ?? 0;

  const available = sql<number>`(${products.stockQty} - ${products.reservedQty})::int`;
  const lowStock = await db
    .select({ id: products.id, name: products.name, sku: products.sku, available })
    .from(products)
    .where(and(eq(products.status, 'active'), lte(available, 3)))
    .orderBy(available, products.sku)
    .limit(8);

  const revenueUzs = Number(totals?.revenue ?? 0);
  const orderCount = totals?.orders ?? 0;
  const paidOrders = totals?.paidOrders ?? 0;
  const views = eventCount('configurator_view');
  const toCart = eventCount('build_to_cart');
  return {
    from,
    to,
    revenueUzs,
    orders: orderCount,
    paidOrders,
    aovUzs: paidOrders > 0 ? Math.round(revenueUzs / paidOrders) : 0,
    paidShare: orderCount > 0 ? paidOrders / orderCount : 0,
    conversion: views > 0 ? toCart / views : 0,
    daily,
    topProducts: topProducts.map((p) => ({ ...p, revenueUzs: Number(p.revenueUzs) })),
    topBuilds: topBuilds.map((b) => ({ ...b, totalUzs: Number(b.totalUzs) })),
    funnel: { views, saved: eventCount('build_saved'), toCart, orders: orderCount },
    lowStock,
  };
}
