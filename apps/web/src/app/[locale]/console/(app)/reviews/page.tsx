import { getDb } from '@redcore/db';
import { formatDate, isLocale } from '@redcore/i18n';
import { listReviews } from '@redcore/services';
import { StarIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ConsoleLink } from '@/features/console/console-base';
import { ReviewModeration } from '@/features/console/controls';
import { PageHeader } from '@/features/console/ui';
import { cn } from '@/lib/utils';
import { requireStaff } from '@/server/staff';

const TABS = ['pending', 'approved', 'rejected'] as const;

export default async function ConsoleReviewsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/console/reviews'>) {
  await requireStaff('reviews');
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = (await searchParams).status;
  const status = TABS.find((s) => s === raw) ?? 'pending';
  const [t, tc, list] = await Promise.all([
    getTranslations({ locale, namespace: 'console.reviews' }),
    getTranslations({ locale, namespace: 'console.common' }),
    listReviews(await getDb(), status),
  ]);
  return (
    <>
      <PageHeader
        title={t('title')}
        actions={TABS.map((s) => (
          <ConsoleLink
            key={s}
            href={`/reviews?status=${s}`}
            aria-current={s === status ? 'page' : undefined}
            className={cn(
              'rounded-md border border-graphite-800 px-3 py-1.5 text-xs',
              s === status ? 'border-brand/60 bg-brand/10' : 'text-steel-300',
            )}
          >
            {t(`tabs.${s}`)}
          </ConsoleLink>
        ))}
      />
      {list.length === 0 ? (
        <p className="text-sm text-steel-400">{tc('empty')}</p>
      ) : (
        <ul className="space-y-3" data-testid="console-reviews">
          {list.map(({ review: r, productName, productSlug }) => (
            <li
              key={r.id}
              className="space-y-2 rounded-xl border border-graphite-800 bg-graphite-900/60 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <a
                  href={`/${locale}/p/${productSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                >
                  {productName}
                </a>
                <span className="text-xs text-steel-400">{`${r.authorName} · ${formatDate(r.createdAt, locale)} · ${r.locale.toUpperCase()}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex gap-0.5 text-warning" aria-label={String(r.rating)}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <StarIcon
                      key={i}
                      className={cn('size-3.5', i < r.rating ? 'fill-current' : 'opacity-30')}
                    />
                  ))}
                </span>
                {r.verifiedPurchase > 0 && <Badge variant="success">{t('verified')}</Badge>}
              </div>
              <p>{r.text}</p>
              {r.pros && <p className="text-xs text-success">{t('pros', { text: r.pros })}</p>}
              {r.cons && <p className="text-xs text-danger">{t('cons', { text: r.cons })}</p>}
              <ReviewModeration id={r.id} status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
