import { getDb } from '@redcore/db';
import { formatDate, isLocale } from '@redcore/i18n';
import { listAudit } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { DataTable, PageHeader } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

export default async function ConsoleAuditPage({ params }: PageProps<'/[locale]/console/audit'>) {
  await requireStaff('audit');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [t, tc, rows] = await Promise.all([
    getTranslations({ locale, namespace: 'console.audit' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listAudit(await getDb()),
  ]);
  return (
    <>
      <PageHeader title={t('title')} />
      <DataTable
        testId="audit-log"
        empty={tc('empty')}
        columns={[
          { key: 'date', label: t('cols.date') },
          { key: 'actor', label: t('cols.actor') },
          { key: 'action', label: t('cols.action') },
          { key: 'entity', label: t('cols.entity') },
          { key: 'ip', label: t('cols.ip') },
          { key: 'diff', label: t('cols.diff') },
        ]}
        rows={rows.map((r) => ({
          key: r.id,
          cells: {
            date: formatDate(r.createdAt, locale, { dateStyle: 'short', timeStyle: 'medium' }),
            actor: r.actorEmail ?? '',
            action: <span className="font-mono text-xs">{r.action}</span>,
            entity: (
              <span className="font-mono text-xs">
                {r.entityId ? `${r.entity}:${r.entityId.slice(0, 8)}` : r.entity}
              </span>
            ),
            ip: <span className="font-mono text-xs">{r.ip ?? ''}</span>,
            diff: r.diff ? (
              <code
                className="block max-w-md truncate font-mono text-[11px] text-steel-400"
                title={JSON.stringify(r.diff)}
              >
                {JSON.stringify(r.diff)}
              </code>
            ) : (
              ''
            ),
          },
        }))}
      />
    </>
  );
}
