import { getDb } from '@redcore/db';
import { formatDate, isLocale } from '@redcore/i18n';
import { listLowStock, listMovements } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ConsoleLink } from '@/features/console/console-base';
import { DataTable, PageHeader, Panel } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

const LOW_STOCK = 3;

export default async function ConsoleStockPage({ params }: PageProps<'/[locale]/console/stock'>) {
  await requireStaff('stock');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const db = await getDb();
  const [t, tc, low, movements] = await Promise.all([
    getTranslations({ locale, namespace: 'console.stock' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listLowStock(db, LOW_STOCK),
    listMovements(db),
  ]);
  return (
    <>
      <PageHeader title={t('title')} />
      <Panel title={t('lowStock', { n: LOW_STOCK })}>
        <DataTable
          testId="low-stock"
          empty={tc('empty')}
          columns={[
            { key: 'product', label: t('cols.product') },
            { key: 'stock', label: t('cols.stock'), align: 'right' },
            { key: 'reserved', label: t('cols.reserved'), align: 'right' },
            { key: 'available', label: t('cols.available'), align: 'right' },
          ]}
          rows={low.map((p) => ({
            key: p.id,
            cells: {
              product: (
                <ConsoleLink href={`/products/${p.id}`} className="hover:underline">
                  {`${p.name} · ${p.sku}`}
                </ConsoleLink>
              ),
              stock: p.stockQty,
              reserved: p.reservedQty,
              available: (
                <span className={p.available <= 0 ? 'text-danger' : 'text-warning'}>
                  {p.available}
                </span>
              ),
            },
          }))}
        />
      </Panel>
      <Panel title={t('movements')}>
        <DataTable
          testId="movements"
          empty={tc('empty')}
          columns={[
            { key: 'date', label: t('cols.date') },
            { key: 'product', label: t('cols.product') },
            { key: 'reason', label: t('cols.reason') },
            { key: 'order', label: t('cols.order') },
            { key: 'delta', label: t('cols.delta'), align: 'right' },
          ]}
          rows={movements.map((m) => ({
            key: m.id,
            cells: {
              date: formatDate(m.createdAt, locale, { dateStyle: 'short', timeStyle: 'short' }),
              product: m.productName,
              reason: m.note ? `${t(`reasons.${m.reason}`)} · ${m.note}` : t(`reasons.${m.reason}`),
              order: m.orderNumber ? (
                <ConsoleLink
                  href={`/orders/${m.orderNumber}`}
                  className="font-mono text-xs hover:underline"
                >
                  {m.orderNumber}
                </ConsoleLink>
              ) : (
                ''
              ),
              delta: m.delta > 0 ? `+${m.delta}` : String(m.delta),
            },
          }))}
        />
      </Panel>
    </>
  );
}
