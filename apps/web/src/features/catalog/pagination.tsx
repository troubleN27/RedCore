import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** Ссылочная пагинация: каждая страница — свой URL (индексируется и работает без JS). */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  const t = useTranslations('catalog.pagination');
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );

  const base =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-graphite-800 px-3 text-sm transition-colors hover:border-brand-bright/60';

  return (
    <nav aria-label={t('label')} className="flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} rel="prev" className={base} aria-label={t('previous')}>
          <ChevronLeftIcon className="size-4" />
        </Link>
      )}
      {pages.map((p, index) => (
        <span key={p} className="flex items-center gap-2">
          {index > 0 && p - pages[index - 1]! > 1 && (
            <span aria-hidden="true" className="text-steel-400">
              …
            </span>
          )}
          <Link
            href={hrefFor(p)}
            aria-label={t('page', { page: p })}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              base,
              p === page && 'border-transparent bg-brand text-white shadow-glow-sm',
            )}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount && (
        <Link href={hrefFor(page + 1)} rel="next" className={base} aria-label={t('next')}>
          <ChevronRightIcon className="size-4" />
        </Link>
      )}
    </nav>
  );
}
