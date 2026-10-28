import { getDb } from '@redcore/db';
import { formatDate, formatPrice, isLocale } from '@redcore/i18n';
import { listUserOrders } from '@redcore/services';
import { ChevronRightIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/server/auth';

export default async function AccountOrdersPage({ params }: PageProps<'/[locale]/account/orders'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  if (!session) notFound();
  const [t, to, list] = await Promise.all([
    getTranslations({ locale, namespace: 'account.orders' }),
    getTranslations({ locale, namespace: 'order' }),
    listUserOrders(await getDb(), session.user.id),
  ]);
  if (list.length === 0) return <p className="text-steel-300">{t('empty')}</p>;
  return (
    <ul
      className="divide-y divide-white/5 rounded-xl border border-graphite-800 bg-graphite-900"
      data-testid="account-orders"
    >
      {list.map((order) => (
        <li key={order.id}>
          <Link
            href={`/orders/${order.number}`}
            className="flex items-center gap-4 p-4 hover:bg-white/[0.02]"
          >
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block font-mono text-sm font-semibold">{order.number}</span>
              <span className="block text-xs text-steel-400">
                {`${formatDate(order.createdAt, locale)} · ${t('itemsCount', { count: order.itemCount })}`}
              </span>
            </span>
            <Badge variant="outline">{to(`status.${order.status}`)}</Badge>
            <span className="w-32 text-right text-sm font-semibold tabular-nums">
              {formatPrice(order.totalUzs, locale)}
            </span>
            <ChevronRightIcon className="size-4 text-steel-400" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
