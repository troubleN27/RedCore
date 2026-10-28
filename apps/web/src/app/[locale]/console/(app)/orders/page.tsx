import { getDb } from '@redcore/db';
import { orderStatuses } from '@redcore/domain';
import { formatDate, formatPrice, isLocale } from '@redcore/i18n';
import { listAdminOrders } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ConsoleLink } from '@/features/console/console-base';
import { DataTable, PageHeader, Pager, SearchForm } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default async function ConsoleOrdersPage({
  params,
  searchParams,
}: PageProps<'/[locale]/console/orders'>) {
  await requireStaff('orders');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const filter = { q: str(sp.q), status: str(sp.status), page: Number(str(sp.page) ?? 1) || 1 };
  const [t, tc, to, data] = await Promise.all([
    getTranslations({ locale, namespace: 'console.orders' }),
    getTranslations({ locale, namespace: 'console.common' }),
    getTranslations({ locale, namespace: 'order' }),
    listAdminOrders(await getDb(), filter),
  ]);

  return (
    <>
      <PageHeader title={t('title')} />
      <SearchForm
        value={filter.q}
        placeholder={t('searchPlaceholder')}
        extra={
          <select
            name="status"
            defaultValue={filter.status ?? ''}
            aria-label={t('cols.status')}
            className="h-9 rounded-md border border-input bg-graphite-900 px-2 text-sm"
          >
            <option value="">{tc('all')}</option>
            {orderStatuses.map((s) => (
              <option key={s} value={s}>
                {to(`status.${s}`)}
              </option>
            ))}
          </select>
        }
      />
      <DataTable
        testId="console-orders"
        empty={tc('empty')}
        columns={[
          { key: 'number', label: t('cols.number') },
          { key: 'date', label: t('cols.date') },
          { key: 'customer', label: t('cols.customer') },
          { key: 'status', label: t('cols.status') },
          { key: 'payment', label: t('cols.payment') },
          { key: 'total', label: t('cols.total'), align: 'right' },
        ]}
        rows={data.rows.map((o) => ({
          key: o.id,
          cells: {
            number: (
              <ConsoleLink
                href={`/orders/${o.number}`}
                className="font-mono font-semibold text-brand-bright hover:underline"
              >
                {o.number}
              </ConsoleLink>
            ),
            date: formatDate(o.createdAt, locale, { dateStyle: 'short', timeStyle: 'short' }),
            customer: (
              <span>
                {o.contactName}
                <span className="block text-xs text-steel-400">{o.contactPhone}</span>
              </span>
            ),
            status: <Badge variant="outline">{to(`status.${o.status}`)}</Badge>,
            payment: `${to(`method.${o.paymentMethod}`)} · ${to(`paymentStatus.${o.paymentStatus}`)}`,
            total: formatPrice(o.totalUzs, locale),
          },
        }))}
      />
      <Pager
        page={data.page}
        pages={data.pages}
        basePath="/orders"
        query={{ q: filter.q, status: filter.status }}
        labels={{
          prev: tc('prev'),
          next: tc('next'),
          page: tc('page', { page: data.page, pages: data.pages }),
        }}
      />
    </>
  );
}
