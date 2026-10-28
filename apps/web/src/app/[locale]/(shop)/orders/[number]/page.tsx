import { getDb } from '@redcore/db';
import type { OrderStatus } from '@redcore/domain';
import { formatDate, formatPrice, isLocale } from '@redcore/i18n';
import { canViewOrder, expireStaleOrders, getOrderByNumber } from '@redcore/services';
import { CheckCircle2Icon, CircleDotIcon, LockIcon, PackageIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CancelOrderButton,
  ConfirmDraftButton,
  TelegramSubscribe,
} from '@/features/orders/order-actions';
import { PaymentPanel } from '@/features/orders/payment-panel';
import { env } from '@/env';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/server/auth';
import { paymentProvider, sendOrderNotifications } from '@/server/payments';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/orders/[number]'>): Promise<Metadata> {
  const { locale, number } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'order' });
  return { title: t('title', { number }), robots: { index: false, follow: false } };
}

const statusTone: Record<OrderStatus, 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  draft: 'secondary',
  created: 'info',
  pending_payment: 'warning',
  paid: 'success',
  assembling: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'secondary',
};

/** Подписка на статусы не нужна черновику и завершённым заказам */
const NO_TELEGRAM = new Set(['draft', 'cancelled', 'refunded', 'delivered']);

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<'/[locale]/orders/[number]'>) {
  const { locale, number } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const token = typeof query.token === 'string' ? query.token : null;
  const db = await getDb();

  // Страховка от потерянного вебхука: просроченные неоплаченные заказы отменяются при просмотре
  const expired = await expireStaleOrders(db);
  if (expired.length > 0) void sendOrderNotifications(expired);

  const [view, session, t, ts] = await Promise.all([
    getOrderByNumber(db, number),
    getSession(),
    getTranslations({ locale, namespace: 'order' }),
    getTranslations({ locale, namespace: 'cart.summary' }),
  ]);
  if (!view) notFound();
  const viewer = {
    userId: session?.user.id,
    role: (session?.user as { role?: string } | undefined)?.role,
    token,
  };
  if (!canViewOrder(view, viewer)) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <LockIcon className="mx-auto size-10 text-steel-400" />
        <h1 className="font-display text-2xl font-bold">{t('title', { number })}</h1>
        <p className="text-steel-300">{t('accessDenied')}</p>
        <Button asChild>
          <Link href={`/login?next=/orders/${number}`}>{t('toAccount')}</Link>
        </Button>
      </div>
    );
  }

  const { order, items, services, history, payments, zone, promoCode } = view;
  const price = (amount: number) => formatPrice(amount, locale);
  const latestPayment = payments[0];
  const payable =
    order.paymentMethod === 'card' &&
    (order.status === 'created' || order.status === 'pending_payment');
  const cancellable =
    order.status === 'draft' || order.status === 'created' || order.status === 'pending_payment';
  const td = await getTranslations({ locale, namespace: 'order.draft' });
  const address = order.addressSnapshot;
  const reasonKey = order.cancelReason as 'payment_expired' | 'customer' | 'admin' | null;

  return (
    <div
      className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
      data-testid="order-page"
      data-status={order.status}
    >
      {query.new === '1' && (
        <p
          className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-success"
          role="status"
        >
          <CheckCircle2Icon className="size-5" />
          {t('thanks')}
        </p>
      )}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t('title', { number: order.number })}
          </h1>
          <p className="text-sm text-steel-300">
            {t('createdAt', {
              date: formatDate(order.createdAt, locale, { dateStyle: 'long', timeStyle: 'short' }),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusTone[order.status]} data-testid="order-status">
              {t(`status.${order.status}`)}
            </Badge>
            <Badge variant="outline" data-testid="payment-status">
              {`${t(`method.${order.paymentMethod}`)} · ${t(`paymentStatus.${order.paymentStatus}`)}`}
            </Badge>
          </div>
          {order.status === 'cancelled' && reasonKey && (
            <p className="text-sm text-danger">
              {t('cancelledBecause', { reason: t(`cancelReasons.${reasonKey}`) })}
            </p>
          )}
        </div>
        {cancellable && <CancelOrderButton number={order.number} token={token} />}
      </header>

      {order.status === 'draft' && (
        <section
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand-bright/40 bg-brand/10 p-4"
          data-testid="draft-banner"
        >
          <div className="max-w-2xl space-y-1">
            <h2 className="font-display font-bold">{td('title')}</h2>
            <p className="text-sm text-steel-300">{td('text')}</p>
          </div>
          <ConfirmDraftButton number={order.number} token={token} />
        </section>
      )}

      {!order.userId && <p className="text-xs text-steel-400">{t('guestNote')}</p>}

      {!NO_TELEGRAM.has(order.status) && <TelegramSubscribe number={order.number} token={token} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {payable && (
            <PaymentPanel
              key={`${latestPayment?.id ?? 'new'}-${latestPayment?.updatedAt.toISOString() ?? ''}`}
              number={order.number}
              token={token}
              totalUzs={order.totalUzs}
              declineCode={latestPayment?.status === 'pending' ? latestPayment.failureCode : null}
              publishableKey={
                paymentProvider() === 'stripe'
                  ? (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null)
                  : null
              }
            />
          )}
          {order.status === 'paid' && (
            <p
              className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success"
              data-testid="payment-success"
            >
              <CheckCircle2Icon className="size-4" />
              {t('pay.success')}
            </p>
          )}

          <section className="space-y-3" aria-labelledby="items-title">
            <h2 id="items-title" className="text-lg font-semibold">
              {t('items')}
            </h2>
            <ul className="divide-y divide-white/5 rounded-xl border border-graphite-800 bg-graphite-900">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <PackageIcon className="size-4 shrink-0 text-steel-400" />
                    <span className="min-w-0">
                      <span className="block truncate">
                        {item.qty > 1 ? `${item.name} × ${item.qty}` : item.name}
                      </span>
                      <span className="font-mono text-[11px] text-steel-400">{item.sku}</span>
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{price(item.priceUzs * item.qty)}</span>
                </li>
              ))}
              {services.map((service) => (
                <li key={service.id} className="flex justify-between gap-4 p-4 text-sm">
                  <span>{service.name[locale]}</span>
                  <span className="tabular-nums">{price(service.priceUzs)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3" aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="text-lg font-semibold">
              {t('timeline')}
            </h2>
            <ol
              className="space-y-3 border-l border-graphite-700 pl-5"
              data-testid="order-timeline"
            >
              {history.map((entry) => (
                <li key={entry.id} className="relative text-sm">
                  <CircleDotIcon className="absolute top-0.5 -left-[1.72rem] size-3.5 bg-background text-brand-bright" />
                  <p className="font-medium">{t(`status.${entry.toStatus}`)}</p>
                  <p className="text-xs text-steel-400">
                    {`${formatDate(entry.createdAt, locale, { dateStyle: 'medium', timeStyle: 'short' })} · ${t(`actors.${entry.actorType}`)}`}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:self-start">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-graphite-950/80 p-5 text-sm shadow-panel">
            <dl className="space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-steel-300">{ts('subtotal')}</dt>
                <dd className="tabular-nums">{price(order.subtotalUzs)}</dd>
              </div>
              {order.discountUzs > 0 && (
                <div className="flex justify-between gap-3 text-success">
                  <dt>{promoCode ? t('promo', { code: promoCode }) : ts('discount')}</dt>
                  <dd className="tabular-nums">{`−${price(order.discountUzs)}`}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-steel-300">{t('delivery')}</dt>
                <dd className="tabular-nums">{price(order.deliveryUzs)}</dd>
              </div>
              {order.servicesUzs > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-steel-300">{ts('services')}</dt>
                  <dd className="tabular-nums">{price(order.servicesUzs)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-white/5 pt-3">
                <dt className="font-semibold">{ts('total')}</dt>
                <dd
                  className="font-display text-xl font-bold tabular-nums"
                  data-testid="order-total"
                >
                  {price(order.totalUzs)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="space-y-2 rounded-2xl border border-graphite-800 bg-graphite-900/60 p-5 text-sm">
            <h2 className="font-semibold">{t('delivery')}</h2>
            <p className="text-steel-300">{zone.isPickup ? t('pickup') : zone.name[locale]}</p>
            {address && (
              <p className="text-steel-300">
                {[address.city, address.district, address.street, address.house, address.apartment]
                  .filter(Boolean)
                  .join(', ')}
                {address.landmark && (
                  <span className="block text-xs text-steel-400">{address.landmark}</span>
                )}
              </p>
            )}
            <h2 className="pt-2 font-semibold">{t('contact')}</h2>
            <p className="text-steel-300">{`${order.contactName} · ${order.contactPhone}`}</p>
            {order.comment && (
              <>
                <h2 className="pt-2 font-semibold">{t('comment')}</h2>
                <p className="text-steel-300">{order.comment}</p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {session && (
              <Button asChild variant="outline" size="sm">
                <Link href="/account/orders">{t('toAccount')}</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/catalog">{t('continue')}</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
