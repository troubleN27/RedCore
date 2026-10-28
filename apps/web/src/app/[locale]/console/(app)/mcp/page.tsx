import { getDb } from '@redcore/db';
import { formatDate, isLocale } from '@redcore/i18n';
import { listApiKeys, listToolCalls } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ApiKeyCreateForm, ApiKeyRevoke } from '@/features/console/mcp-keys';
import { DataTable, PageHeader, Panel } from '@/features/console/ui';
import { env } from '@/env';
import { requireStaff } from '@/server/staff';

const MCP_PATH = '/api/mcp';

export default async function ConsoleMcpPage({ params }: PageProps<'/[locale]/console/mcp'>) {
  await requireStaff('mcp');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const db = await getDb();
  const [t, tc, keys, calls] = await Promise.all([
    getTranslations({ locale, namespace: 'console.mcp' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listApiKeys(db),
    listToolCalls(db),
  ]);
  const when = (d: Date | null) =>
    d ? formatDate(d, locale, { dateStyle: 'short', timeStyle: 'short' }) : t('keys.never');

  return (
    <>
      <PageHeader title={t('title')} />
      <p className="mb-4 max-w-3xl text-sm text-steel-400">
        {t('hint', { url: `${env.NEXT_PUBLIC_SITE_URL}${MCP_PATH}` })}
      </p>
      <Panel title={t('keys.new')}>
        <ApiKeyCreateForm />
      </Panel>
      <h2 className="mt-6 mb-3 font-display text-lg font-bold">{t('keys.title')}</h2>
      <DataTable
        testId="api-keys"
        empty={tc('empty')}
        columns={[
          { key: 'name', label: t('keys.cols.name') },
          { key: 'scopes', label: t('keys.cols.scopes') },
          { key: 'user', label: t('keys.cols.user') },
          { key: 'lastUsed', label: t('keys.cols.lastUsed') },
          { key: 'status', label: t('keys.cols.status') },
        ]}
        rows={keys.map((k) => ({
          key: k.id,
          cells: {
            name: (
              <span>
                <span className="font-semibold">{k.name}</span>
                <span className="block font-mono text-xs text-steel-400">{`${k.prefix}…`}</span>
              </span>
            ),
            scopes: <span className="font-mono text-xs">{k.scopes.join(', ')}</span>,
            user: k.userLogin ?? '',
            lastUsed: when(k.lastUsedAt),
            status: k.revokedAt ? (
              <span className="text-steel-400">{t('keys.revoked')}</span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-success">{t('keys.active')}</span>
                <ApiKeyRevoke id={k.id} />
              </span>
            ),
          },
        }))}
      />
      <h2 className="mt-6 mb-3 font-display text-lg font-bold">{t('calls.title')}</h2>
      <DataTable
        testId="tool-calls"
        empty={tc('empty')}
        columns={[
          { key: 'at', label: t('calls.cols.at') },
          { key: 'tool', label: t('calls.cols.tool') },
          { key: 'source', label: t('calls.cols.source') },
          { key: 'args', label: t('calls.cols.args') },
          { key: 'result', label: t('calls.cols.result') },
          { key: 'ms', label: t('calls.cols.ms'), align: 'right' },
        ]}
        rows={calls.rows.map((c) => ({
          key: c.id,
          cells: {
            at: when(c.createdAt),
            tool: <span className="font-mono text-xs">{c.tool}</span>,
            source: `${t(`calls.sources.${c.source}`)} · ${c.transport}${c.keyName ? ` · ${c.keyName}` : ''}`,
            args: (
              <code className="line-clamp-2 max-w-xs font-mono text-[11px] break-all text-steel-300">
                {JSON.stringify(c.args)}
              </code>
            ),
            result: c.ok ? (
              <span className="text-success">{t('calls.ok')}</span>
            ) : (
              <span className="text-danger">{c.error}</span>
            ),
            ms: String(c.durationMs),
          },
        }))}
      />
    </>
  );
}
