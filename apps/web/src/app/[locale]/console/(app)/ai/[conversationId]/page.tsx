import { getDb } from '@redcore/db';
import { formatDate, isLocale } from '@redcore/i18n';
import { getConversationMessages } from '@redcore/services';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/features/console/ui';
import { requireStaff } from '@/server/staff';

const USER = 'user';

export default async function ConsoleAiDialogPage({
  params,
}: PageProps<'/[locale]/console/ai/[conversationId]'>) {
  await requireStaff('ai');
  const { locale, conversationId } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(conversationId)) notFound();
  const [t, messages] = await Promise.all([
    getTranslations({ locale, namespace: 'console.ai.dialog' }),
    getConversationMessages(await getDb(), conversationId),
  ]);
  if (messages.length === 0) notFound();
  return (
    <>
      <PageHeader title={t('title')} />
      <ol className="max-w-3xl space-y-3" data-testid="ai-dialog">
        {messages.map((m) => (
          <li
            key={m.id}
            className={
              m.role === USER
                ? 'rounded-lg bg-graphite-900 p-3'
                : 'rounded-lg border border-graphite-800 p-3'
            }
          >
            <p className="mb-1 text-xs text-steel-400">
              {m.role === USER ? t('user') : `${t('assistant')} · ${m.agent ?? ''}`} ·{' '}
              {formatDate(m.createdAt, locale, { dateStyle: 'short', timeStyle: 'medium' })}
            </p>
            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            {m.ui.length > 0 && (
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/40 p-2 text-[10px] text-steel-300">
                {JSON.stringify(m.ui, null, 1)}
              </pre>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
