import { getDb } from '@redcore/db';
import { formatDate, formatPrice, isLocale } from '@redcore/i18n';
import { listPromos } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PromoCreateForm, PromoToggle } from '@/features/console/controls';
import { DataTable, PageHeader, Panel } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

export default async function ConsolePromosPage({ params }: PageProps<'/[locale]/console/promos'>) {
  await requireStaff('promos');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [t, tc, list] = await Promise.all([
    getTranslations({ locale, namespace: 'console.promos' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listPromos(await getDb()),
  ]);
  return (
    <>
      <PageHeader title={t('title')} />
      <Panel title={t('new')}>
        <PromoCreateForm />
      </Panel>
      <DataTable
        testId="console-promos"
        empty={tc('empty')}
        columns={[
          { key: 'code', label: t('cols.code') },
          { key: 'value', label: t('cols.value') },
          { key: 'minOrder', label: t('cols.minOrder') },
          { key: 'used', label: t('cols.used'), align: 'right' },
          { key: 'ends', label: t('cols.ends') },
          { key: 'active', label: t('cols.active') },
        ]}
        rows={list.map((p) => ({
          key: p.id,
          cells: {
            code: (
              <span>
                <span className="font-mono font-semibold">{p.code}</span>
                {p.description?.[locale] && (
                  <span className="block text-xs text-steel-400">{p.description[locale]}</span>
                )}
              </span>
            ),
            value: p.type === 'percent' ? `${p.value}%` : formatPrice(p.value, locale),
            minOrder: p.minOrderUzs ? formatPrice(p.minOrderUzs, locale) : '',
            used: p.usageLimit ? `${p.usedCount} / ${p.usageLimit}` : String(p.usedCount),
            ends: p.endsAt ? formatDate(p.endsAt, locale) : '',
            active: <PromoToggle id={p.id} isActive={p.isActive} />,
          },
        }))}
      />
    </>
  );
}
