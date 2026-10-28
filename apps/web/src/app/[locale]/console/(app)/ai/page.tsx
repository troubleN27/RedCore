import { getDb } from '@redcore/db';
import { formatDate, isLocale } from '@redcore/i18n';
import {
  AI_LOG_PAGE,
  getAiSettings,
  listAiRuns,
  listPendingDrafts,
  productCopySchema,
} from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminAssistant, AiSettingsForm, DraftReview } from '@/features/console/ai-controls';
import { ConsoleLink } from '@/features/console/console-base';
import { DataTable, PageHeader, Pager, Panel } from '@/features/console/ui';
import { env } from '@/env';
import { canAccess, requireStaff } from '@/server/staff';

const AGENTS = ['consultant', 'reviewer', 'support', 'admin'] as const;
const LOCALES = ['ru', 'uz'] as const;
const BASE = '/ai';
const ERRORS_ON = '1';
const SETTINGS = 'settings' as const;

export default async function ConsoleAiPage({
  params,
  searchParams,
}: PageProps<'/[locale]/console/ai'>) {
  const staff = await requireStaff('ai');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const agent = AGENTS.find((a) => a === query.agent);
  const errorsOnly = query.errors === ERRORS_ON;
  const page = Number(query.page) || 1;
  const db = await getDb();
  const [t, tw, tc, drafts, logs, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'console.ai' }),
    getTranslations({ locale, namespace: 'ai.widget' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listPendingDrafts(db),
    listAiRuns(db, { agent, errorsOnly, page }),
    getAiSettings(db),
  ]);
  const maxTokens = Math.max(1, ...logs.daily.map((d) => d.tokens));
  const pages = Math.max(1, Math.ceil(logs.total / AI_LOG_PAGE));

  return (
    <>
      <PageHeader title={t('title')} />
      {!env.GEMINI_API_KEY && (
        <p className="mb-4 text-sm text-warning" data-testid="ai-key-missing">
          {t('settings.keyMissing')}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-6">
          <Panel title={t('drafts.title')}>
            {drafts.length === 0 ? (
              <p className="text-sm text-steel-400">{t('drafts.empty')}</p>
            ) : (
              <ul className="space-y-4" data-testid="ai-drafts">
                {drafts.map((d) => {
                  const copy = productCopySchema.safeParse(d.payload);
                  return (
                    <li
                      key={d.id}
                      className="space-y-2 rounded-lg border border-graphite-800 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">
                          {d.productName}{' '}
                          <span className="font-mono text-xs text-steel-400">{d.sku}</span>
                        </p>
                        <DraftReview id={d.id} />
                      </div>
                      {copy.success && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {LOCALES.map((l) => (
                            <div key={l} className="space-y-1 text-xs">
                              <p className="font-semibold text-steel-400 uppercase">{l}</p>
                              <p>{copy.data[l].short}</p>
                              <p className="text-steel-300">{copy.data[l].description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title={t('logs.daily')}>
            <div className="flex h-32 items-end gap-1" data-testid="ai-daily">
              {logs.daily.map((d) => (
                <div
                  key={d.day}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${d.day}: ${t('logs.series.runs')} ${d.runs}, ${t('logs.series.tokens')} ${d.tokens}, ${t('logs.series.errors')} ${d.errors}, ${t('logs.series.fallbacks')} ${d.fallbacks}`}
                >
                  <div className="flex h-24 w-full flex-col justify-end">
                    <div
                      className="w-full rounded-t bg-brand"
                      style={{ height: `${Math.max(2, (d.tokens / maxTokens) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-steel-400">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <form className="flex flex-wrap items-center gap-3 text-sm">
            <select
              name="agent"
              defaultValue={agent ?? ''}
              className="h-9 rounded-md border border-graphite-700 bg-graphite-900 px-2"
            >
              <option value="">{t('logs.filters.all')}</option>
              {AGENTS.map((a) => (
                <option key={a} value={a}>
                  {tw(`agents.${a}`)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="errors" value={ERRORS_ON} defaultChecked={errorsOnly} />
              {t('logs.filters.errors')}
            </label>
            <button
              type="submit"
              className="rounded-md border border-graphite-700 px-3 py-1.5 hover:border-brand-bright/60"
            >
              {t('logs.filters.apply')}
            </button>
          </form>
          <DataTable
            testId="ai-runs"
            empty={tc('empty')}
            columns={[
              { key: 'at', label: t('logs.cols.at') },
              { key: 'agent', label: t('logs.cols.agent') },
              { key: 'mode', label: t('logs.cols.mode') },
              { key: 'tokens', label: t('logs.cols.tokens'), align: 'right' },
              { key: 'latency', label: t('logs.cols.latency'), align: 'right' },
              { key: 'cost', label: t('logs.cols.cost'), align: 'right' },
              { key: 'dialog', label: t('logs.cols.dialog') },
            ]}
            rows={logs.rows.map((r) => ({
              key: r.id,
              cells: {
                at: formatDate(r.createdAt, locale, { dateStyle: 'short', timeStyle: 'medium' }),
                agent: tw(`agents.${r.agent}`),
                mode: (
                  <span className="text-xs">
                    {r.deterministic
                      ? t('logs.modes.deterministic', { reason: r.deterministic })
                      : `${r.model ?? ''}${r.fallbackFrom ? ` (${t('logs.modes.fallback')}: ${r.fallbackFrom})` : ''}`}
                    {r.guardRetried && (
                      <span className="ml-1 text-warning">{t('logs.modes.guard')}</span>
                    )}
                    {r.error && <span className="block text-danger">{r.error}</span>}
                  </span>
                ),
                tokens: String(r.inputTokens + r.outputTokens + r.thoughtTokens),
                latency: String(r.latencyMs),
                cost: (r.costUsdMicros / 1_000_000).toFixed(4),
                dialog: r.conversationId ? (
                  <ConsoleLink
                    href={`${BASE}/${r.conversationId}`}
                    className="text-brand-bright hover:underline"
                  >
                    {t('logs.open')}
                  </ConsoleLink>
                ) : null,
              },
            }))}
          />
          <Pager
            page={logs.page}
            pages={pages}
            basePath={BASE}
            query={{ agent, errors: errorsOnly ? ERRORS_ON : undefined }}
            labels={{
              prev: tc('prev'),
              next: tc('next'),
              page: tc('page', { page: logs.page, pages }),
            }}
          />
        </div>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-950">
            <AdminAssistant />
          </section>
          {canAccess(staff.role, SETTINGS) && (
            <Panel title={t('settings.title')}>
              <AiSettingsForm initial={settings} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
