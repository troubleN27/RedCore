import { getDb } from '@redcore/db';
import { formatNumber, formatPrice, isLocale } from '@redcore/i18n';
import { dashboardPeriods, getDashboard, type DashboardPeriod } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ConsoleLink } from '@/features/console/console-base';
import { OrdersChart, RevenueChart } from '@/features/console/dashboard-charts';
import { PageHeader, Panel } from '@/features/console/ui';
import { cn } from '@/lib/utils';
import { requireStaff } from '@/server/staff';

function Kpi({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  hint?: string;
  testId: string;
}) {
  return (
    <div
      className="space-y-1 rounded-xl border border-graphite-800 bg-graphite-900/60 p-4"
      title={hint}
    >
      <p className="label-caps text-steel-400">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums" data-testid={testId}>
        {value}
      </p>
      {hint && <p className="text-xs text-steel-400">{hint}</p>}
    </div>
  );
}

export default async function ConsoleDashboardPage({
  params,
  searchParams,
}: PageProps<'/[locale]/console'>) {
  await requireStaff('dashboard');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = (await searchParams).period;
  const period: DashboardPeriod =
    typeof raw === 'string' && raw in dashboardPeriods ? (raw as DashboardPeriod) : 'd30';
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: 'console.dashboard' }),
    getDashboard(await getDb(), period),
  ]);
  const price = (v: number) => formatPrice(v, locale);
  const percent = (v: number) => `${formatNumber(v * 100, locale, 1)}%`;
  const funnel = [
    { key: 'views', value: data.funnel.views },
    { key: 'saved', value: data.funnel.saved },
    { key: 'toCart', value: data.funnel.toCart },
    { key: 'orders', value: data.funnel.orders },
  ] as const;
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={(Object.keys(dashboardPeriods) as DashboardPeriod[]).map((p) => (
          <ConsoleLink
            key={p}
            href={`/?period=${p}`}
            aria-current={p === period ? 'page' : undefined}
            className={cn(
              'rounded-md border border-graphite-800 px-3 py-1.5 text-xs',
              p === period
                ? 'border-brand/60 bg-brand/10 text-foreground'
                : 'text-steel-300 hover:text-foreground',
            )}
          >
            {t(`periods.${p}`)}
          </ConsoleLink>
        ))}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={t('kpi.revenue')}
          value={price(data.revenueUzs)}
          hint={t('hints.revenue')}
          testId="kpi-revenue"
        />
        <Kpi
          label={t('kpi.orders')}
          value={formatNumber(data.orders, locale)}
          hint={t('hints.orders')}
          testId="kpi-orders"
        />
        <Kpi label={t('kpi.aov')} value={price(data.aovUzs)} testId="kpi-aov" />
        <Kpi
          label={t('kpi.conversion')}
          value={percent(data.conversion)}
          hint={t('hints.conversion')}
          testId="kpi-conversion"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={t('charts.revenue')}>
          <RevenueChart data={data.daily} label={t('charts.revenue')} />
        </Panel>
        <Panel title={t('charts.orders')}>
          <OrdersChart data={data.daily} label={t('charts.orders')} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={t('topProducts')}>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-steel-400">{t('noData')}</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {data.topProducts.map((p) => (
                <li key={p.productId} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{`${p.name} × ${p.qty}`}</span>
                  <span className="shrink-0 tabular-nums">{price(p.revenueUzs)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title={t('topBuilds')}>
          {data.topBuilds.length === 0 ? (
            <p className="text-sm text-steel-400">{t('noData')}</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {data.topBuilds.map((b) => (
                <li key={b.publicId} className="flex justify-between gap-3">
                  <a
                    href={`/${locale}/b/${b.publicId}`}
                    target="_blank"
                    className="min-w-0 truncate hover:underline"
                    rel="noreferrer"
                  >
                    {b.name ?? b.publicId}
                  </a>
                  <span className="shrink-0 text-steel-400">{t('times', { count: b.count })}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title={t('funnel.title')}>
          <ul className="space-y-2 text-sm" data-testid="funnel">
            {funnel.map((f) => (
              <li key={f.key} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-steel-300">{t(`funnel.${f.key}`)}</span>
                  <span className="tabular-nums">{formatNumber(f.value, locale)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-graphite-800">
                  <div
                    className="h-full rounded-full bg-cta"
                    style={{ width: `${(f.value / funnelMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title={t('lowStock')}>
        {data.lowStock.length === 0 ? (
          <p className="text-sm text-steel-400">{t('noData')}</p>
        ) : (
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {data.lowStock.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <ConsoleLink
                  href={`/products/${p.id}`}
                  className="min-w-0 truncate hover:underline"
                >
                  {p.name}
                </ConsoleLink>
                <span
                  className={cn('tabular-nums', p.available <= 0 ? 'text-danger' : 'text-warning')}
                >
                  {`${p.available} ${t('qty')}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
