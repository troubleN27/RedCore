import { getDb } from '@redcore/db';
import { isLocale } from '@redcore/i18n';
import {
  getStoreSettings,
  listServicesAdmin,
  listZonesAdmin,
  telegramConfig,
  telegramMode,
  telegramSubscriberCount,
} from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ServiceRow, SettingsForm, ZoneRow } from '@/features/console/controls';
import { TelegramTestButton } from '@/features/console/telegram-test';
import { PageHeader, Panel } from '@/features/console/ui';
import { env } from '@/env';
import { requireStaff } from '@/server/staff';

const ZONE_COLS = ['name', 'price', 'freeFrom', 'eta', 'cod', 'active'] as const;
const SERVICE_COLS = ['name', 'price', 'active'] as const;
const TELEGRAM_WEBHOOK = '/api/webhooks/telegram';

export default async function ConsoleSettingsPage({
  params,
}: PageProps<'/[locale]/console/settings'>) {
  await requireStaff('settings');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const db = await getDb();
  const [t, store, zones, services, subscribers] = await Promise.all([
    getTranslations({ locale, namespace: 'console.settings' }),
    getStoreSettings(db),
    listZonesAdmin(db),
    listServicesAdmin(db),
    telegramSubscriberCount(db),
  ]);
  const telegram = telegramConfig();
  const mode = telegramMode(telegram);
  const th = 'px-3 py-2 text-left text-xs font-medium text-steel-400';
  return (
    <>
      <PageHeader title={t('title')} />
      <Panel title={t('telegram.title')}>
        <dl
          className="mb-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]"
          data-testid="telegram-status"
        >
          <dt className="text-steel-400">{t('telegram.mode')}</dt>
          <dd data-mode={mode}>{t(`telegram.modes.${mode}`, { username: telegram.username })}</dd>
          <dt className="text-steel-400">{t('telegram.adminChat')}</dt>
          <dd>{telegram.adminChatId ?? t('telegram.adminChatMissing')}</dd>
          <dt className="text-steel-400">{t('telegram.subscribers')}</dt>
          <dd>{subscribers}</dd>
        </dl>
        <p className="mb-3 font-mono text-xs text-steel-400">
          {t('telegram.webhook', { url: `${env.NEXT_PUBLIC_SITE_URL}${TELEGRAM_WEBHOOK}` })}
        </p>
        <TelegramTestButton disabled={!telegram.adminChatId} />
      </Panel>
      <Panel title={t('pricing')}>
        <SettingsForm initial={store} />
      </Panel>
      <Panel title={t('zones')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem]" data-testid="zones-table">
            <thead>
              <tr>
                {ZONE_COLS.map((k) => (
                  <th key={k} scope="col" className={th}>
                    {t(`zoneCols.${k}`)}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {zones.map((z) => (
                <ZoneRow key={z.id} zone={{ ...z, name: z.name[locale] }} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={t('services')}>
        <table className="w-full">
          <thead>
            <tr>
              {SERVICE_COLS.map((k) => (
                <th key={k} scope="col" className={th}>
                  {t(`serviceCols.${k}`)}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {services.map((s) => (
              <ServiceRow
                key={s.id}
                service={{
                  id: s.id,
                  name: s.name[locale],
                  priceUzs: s.priceUzs,
                  isActive: s.isActive,
                }}
              />
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
