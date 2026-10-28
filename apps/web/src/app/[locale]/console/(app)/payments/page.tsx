import { getDb } from '@redcore/db';
import { formatDate, formatPrice, isLocale } from '@redcore/i18n';
import { listPaymentRecords, listStripeEvents } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ConsoleLink } from '@/features/console/console-base';
import { DataTable, PageHeader, Panel } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

export default async function ConsolePaymentsPage({
  params,
}: PageProps<'/[locale]/console/payments'>) {
  await requireStaff('payments');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const db = await getDb();
  const [t, tc, events, records] = await Promise.all([
    getTranslations({ locale, namespace: 'console.payments' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listStripeEvents(db),
    listPaymentRecords(db),
  ]);
  const date = (d: Date) => formatDate(d, locale, { dateStyle: 'short', timeStyle: 'medium' });
  // Сумма платежа хранится в минимальных единицах валюты (×100)
  const amount = (minor: number, currency: string) =>
    currency === 'uzs'
      ? formatPrice(minor / 100, locale)
      : `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;

  return (
    <>
      <PageHeader title={t('title')} />
      <Panel title={t('records')}>
        <DataTable
          testId="payment-records"
          empty={tc('empty')}
          columns={[
            { key: 'date', label: t('cols.date') },
            { key: 'order', label: t('cols.order') },
            { key: 'provider', label: t('cols.provider') },
            { key: 'attempt', label: t('cols.attempt'), align: 'right' },
            { key: 'status', label: t('cols.status') },
            { key: 'amount', label: t('cols.amount'), align: 'right' },
          ]}
          rows={records.map((p) => ({
            key: p.id,
            cells: {
              date: date(p.createdAt),
              order: (
                <ConsoleLink
                  href={`/orders/${p.orderNumber}`}
                  className="font-mono text-xs hover:underline"
                >
                  {p.orderNumber}
                </ConsoleLink>
              ),
              provider: p.provider,
              attempt: p.attempt,
              status: (
                <span>
                  <Badge
                    variant={
                      p.status === 'succeeded'
                        ? 'success'
                        : p.status === 'pending'
                          ? 'warning'
                          : 'secondary'
                    }
                  >
                    {t(`statuses.${p.status}`)}
                  </Badge>
                  {p.failureCode && (
                    <span className="block text-xs text-danger">{p.failureCode}</span>
                  )}
                </span>
              ),
              amount: amount(p.amountMinor, p.currency),
            },
          }))}
        />
      </Panel>
      <Panel title={t('events')}>
        <DataTable
          testId="stripe-events"
          empty={tc('empty')}
          columns={[
            { key: 'date', label: t('cols.date') },
            { key: 'type', label: t('cols.type') },
            { key: 'event', label: t('cols.event') },
            { key: 'status', label: t('cols.status') },
          ]}
          rows={events.map((e) => ({
            key: e.id,
            cells: {
              date: date(e.createdAt),
              type: <span className="font-mono text-xs">{e.type}</span>,
              event: <span className="font-mono text-[11px] text-steel-400">{e.id}</span>,
              status: (
                <span>
                  <Badge
                    variant={
                      e.status === 'processed'
                        ? 'success'
                        : e.status === 'failed'
                          ? 'danger'
                          : 'secondary'
                    }
                  >
                    {t(`statuses.${e.status}`)}
                  </Badge>
                  {e.error && <span className="block text-xs text-danger">{e.error}</span>}
                </span>
              ),
            },
          }))}
        />
      </Panel>
    </>
  );
}
