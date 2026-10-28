import { getDb } from '@redcore/db';
import { formatDate, isLocale } from '@redcore/i18n';
import { emailMode, listOutbox } from '@redcore/services';
import { MailIcon, MessageSquareIcon, SendIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { mockPaymentsEnabled } from '@/server/payments';

const TELEGRAM = 'telegram';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Ящик для разработки и демо-стенда: письма и SMS, которые не ушли провайдерам. */
function inboxEnabled() {
  return emailMode() === 'mock' && (process.env.NODE_ENV !== 'production' || mockPaymentsEnabled());
}

export default async function DevInboxPage({ params }: PageProps<'/[locale]/dev/inbox'>) {
  const { locale } = await params;
  if (!isLocale(locale) || !inboxEnabled()) notFound();
  const [t, messages] = await Promise.all([
    getTranslations({ locale, namespace: 'inbox' }),
    listOutbox(await getDb(), 50),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
        <p className="text-steel-300">{t('subtitle')}</p>
      </header>
      {messages.length === 0 ? (
        <p className="text-steel-300">{t('empty')}</p>
      ) : (
        <ul className="space-y-4" data-testid="inbox">
          {messages.map((m) => (
            <li
              key={m.id}
              data-testid="inbox-message"
              data-channel={m.channel}
              data-to={m.to}
              className="space-y-3 rounded-xl border border-graphite-800 bg-graphite-900 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-steel-400">
                <span className="flex items-center gap-2">
                  <Badge variant={m.channel === 'email' ? 'info' : 'metal'}>
                    {m.channel === 'email' ? (
                      <MailIcon />
                    ) : m.channel === TELEGRAM ? (
                      <SendIcon />
                    ) : (
                      <MessageSquareIcon />
                    )}
                    {m.channel === 'email'
                      ? t('email')
                      : m.channel === TELEGRAM
                        ? t('telegram')
                        : t('sms')}
                  </Badge>
                  {t('to', { to: m.to })}
                </span>
                <time dateTime={m.createdAt.toISOString()}>
                  {formatDate(m.createdAt, locale, { dateStyle: 'medium', timeStyle: 'medium' })}
                </time>
              </div>
              {m.subject && <p className="font-semibold">{m.subject}</p>}
              <pre className="font-sans text-sm whitespace-pre-wrap text-steel-300">{m.text}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
