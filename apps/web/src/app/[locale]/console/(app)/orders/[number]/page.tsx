import { getDb } from '@redcore/db';
import { formatDate, formatPrice, isLocale } from '@redcore/i18n';
import { adminNextStatuses, getOrderByNumber } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { OrderStatusControls, RefundForm } from '@/features/console/order-controls';
import { PageHeader, Panel } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

export default async function ConsoleOrderPage({
  params,
}: PageProps<'/[locale]/console/orders/[number]'>) {
  await requireStaff('orders');
  const { locale, number } = await params;
  if (!isLocale(locale)) notFound();
  const view = await getOrderByNumber(await getDb(), number);
  if (!view) notFound();
  const [t, to, tp] = await Promise.all([
    getTranslations({ locale, namespace: 'console.orders.detail' }),
    getTranslations({ locale, namespace: 'order' }),
    getTranslations({ locale, namespace: 'console.payments.statuses' }),
  ]);
  const { order, items, services, history, payments, zone } = view;
  const price = (v: number) => formatPrice(v, locale);
  const succeeded = payments.find(
    (p) => p.status === 'succeeded' || p.status === 'partially_refunded',
  );
  const refundable =
    order.paymentMethod === 'card' &&
    succeeded &&
    succeeded.refundedMinor < succeeded.amountMinor &&
    ['paid', 'assembling', 'shipped', 'delivered'].includes(order.status);
  const address = order.addressSnapshot;

  return (
    <div className="space-y-6" data-testid="console-order" data-status={order.status}>
      <PageHeader
        title={to('title', { number: order.number })}
        actions={
          <>
            <Badge variant="outline" data-testid="console-order-status">
              {to(`status.${order.status}`)}
            </Badge>
            <Badge variant="outline">{`${to(`method.${order.paymentMethod}`)} · ${to(`paymentStatus.${order.paymentStatus}`)}`}</Badge>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <Panel title={t('items')}>
            <ul className="divide-y divide-white/5 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0">
                    {i.qty > 1 ? `${i.name} × ${i.qty}` : i.name}
                    <span className="block font-mono text-[11px] text-steel-400">{i.sku}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {price(i.priceUzs * i.qty - i.discountUzs)}
                  </span>
                </li>
              ))}
              {services.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 py-2">
                  <span>{s.name[locale]}</span>
                  <span className="tabular-nums">{price(s.priceUzs)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 py-2 font-semibold">
                <span>{to('delivery')}</span>
                <span className="tabular-nums">{price(order.deliveryUzs)}</span>
              </li>
              <li className="flex justify-between gap-3 py-2 text-base font-bold">
                <span />
                <span className="tabular-nums">{price(order.totalUzs)}</span>
              </li>
            </ul>
            {services.some((s) => s.key === 'pc_assembly') && order.status === 'assembling' && (
              <p className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-steel-300">
                {t('assemblyChecklist')}
              </p>
            )}
          </Panel>
          <Panel title={t('history')}>
            <ol className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {to(`status.${h.toStatus}`)}
                    {h.note && <span className="block text-xs text-steel-400">{h.note}</span>}
                  </span>
                  <span className="text-xs text-steel-400">
                    {`${formatDate(h.createdAt, locale, { dateStyle: 'short', timeStyle: 'short' })} · ${to(`actors.${h.actorType}`)}`}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title={t('payments')}>
            {payments.length === 0 ? (
              <p className="text-sm text-steel-400">{to('method.cod')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2">
                    <span>{`${t('attempt', { n: p.attempt })} · ${p.provider} · ${tp(p.status)}${p.failureCode ? ` (${p.failureCode})` : ''}`}</span>
                    <span className="text-steel-300 tabular-nums">
                      {p.refundedMinor > 0
                        ? t('refundedAmount', { amount: price(p.refundedMinor / 100) })
                        : price(p.amountMinor / 100)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title={t('customer')}>
            <p className="text-sm">{order.contactName}</p>
            <p className="text-sm text-steel-300">{order.contactPhone}</p>
            {order.contactEmail && <p className="text-sm text-steel-300">{order.contactEmail}</p>}
          </Panel>
          <Panel title={t('delivery')}>
            <p className="text-sm">{zone.name[locale]}</p>
            {address && (
              <p className="text-sm text-steel-300">
                {[address.city, address.district, address.street, address.house, address.apartment]
                  .filter(Boolean)
                  .join(', ')}
                {address.landmark && (
                  <span className="block text-xs text-steel-400">{address.landmark}</span>
                )}
              </p>
            )}
            {order.comment && <p className="text-xs text-steel-400">{order.comment}</p>}
          </Panel>
          <Panel title={t('actions')}>
            <OrderStatusControls
              orderId={order.id}
              next={adminNextStatuses(order.status, order.paymentMethod)}
            />
          </Panel>
          {refundable && (
            <Panel title={t('refund.title')}>
              <RefundForm
                orderId={order.id}
                maxUzs={(succeeded.amountMinor - succeeded.refundedMinor) / 100}
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
